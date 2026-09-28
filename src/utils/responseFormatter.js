 
// import { getModelMeta } from "./dynamicInclude.js";

// /* ============================================================
//    BUILD FK MAP (DETERMINISTIC — no value guessing)
//    ------------------------------------------------------------
//    Uses Prisma DMMF to find, for each relation field declared on
//    a model, exactly which scalar FK column backs it.

//    e.g. for std_regions:
//    {
//      std_region_cat: "region_cat",
//      std_budget_cat: "budget_cat"
//    }

//    This replaces the old "guess by matching values" approach,
//    which broke whenever two FK columns pointed at the same id
//    (e.g. region_cat = 1 AND budget_cat = 1).
// ============================================================ */
// const buildFkMap = (modelName, dmmf) => {
//   const map = {};

//   if (!dmmf?.datamodel?.models) return map;

//   const model = dmmf.datamodel.models.find((m) => m.name === modelName);
//   if (!model) return map;

//   model.fields.forEach((field) => {
//     if (
//       field.kind === "object" &&
//       field.relationFromFields &&
//       field.relationFromFields.length === 1 // simple single-column FK only
//     ) {
//       map[field.name] = field.relationFromFields[0];
//     }
//   });

//   return map;
// };

// /* ============================================================
//    FLATTEN RECORD
//    ------------------------------------------------------------
//    - Relation fields (per DMMF) whose joined table has exactly
//      one non-id column → replace the FK scalar's value with that
//      label, in-place, matching the old flat format
//      (region_cat: "master" instead of region_cat: 1)

//    - Relation fields with multiple columns (e.g. vendors' user
//      join, sub-tasks' project join) → keep the FK scalar AND
//      merge the extra fields in UNPREFIXED, matching old
//      sub_tasks/vendors/user_payment_plan behavior

//    - Anything NOT declared as a relation in the schema (e.g. a
//      Json column like region_desc) is left completely untouched,
//      nested exactly as Prisma returned it

//    - to-many relations (arrays) are dropped, matching the old
//      list-response format which never embedded them
// ============================================================ */
// export const flattenRecord = (item, modelName, dmmf) => {
//   if (!item || typeof item !== "object") return item;

//   const fkMap = buildFkMap(modelName, dmmf); // relationFieldName -> fkScalarFieldName
//   const fkScalarsBeingReplaced = new Set(Object.values(fkMap));

//   const flat = {};

//   for (const [key, value] of Object.entries(item)) {

//     // Skip the raw FK scalar here — it gets set (or restored) when we
//     // process its matching relation field below
//     if (fkScalarsBeingReplaced.has(key)) continue;

//     // Not a declared relation field → keep as-is.
//     // This is what protects Json columns (region_desc, etc.) from
//     // being incorrectly flattened.
//     if (!(key in fkMap)) {
//       flat[key] = value;
//       continue;
//     }

//     // ---- This IS a declared relation field ----
//     const fkScalarKey = fkMap[key];

//     if (value === null || value === undefined) {
//       // Relation didn't resolve (FK was null, or nothing matched)
//       // Fall back to whatever the raw scalar value was
//       flat[fkScalarKey] = item[fkScalarKey] ?? null;
//       continue;
//     }

//     if (Array.isArray(value)) {
//       // to-many relation — old format never embedded these
//       continue;
//     }

//     const nestedKeys = Object.keys(value).filter((k) => k !== "id");

//     if (nestedKeys.length === 1) {
//       // Simple lookup table (id + 1 label column)
//       // → old-style: replace the FK scalar value with the label
//       flat[fkScalarKey] = value[nestedKeys[0]];
//     } else {
//       // Complex relation (multiple columns) → keep FK id AND
//       // merge extra fields in unprefixed
//       flat[fkScalarKey] = item[fkScalarKey];

//       for (const [nk, nv] of Object.entries(value)) {
//         if (nk === "id") continue;
//         if (!(nk in flat)) {
//           flat[nk] = nv;
//         }
//       }
//     }
//   }

//   return flat;
// };

// /* ============================================================
//    FLATTEN RESPONSE
//    ------------------------------------------------------------
//    NOTE: signature changed — now takes (data, modelName, dmmf)
//    instead of (data, db). Callers must be updated accordingly.
// ============================================================ */
// export const flattenResponse = (data = [], modelName, dmmf) => {
//   return data.map((item) => flattenRecord(item, modelName, dmmf));
// };

// /* ============================================================
//    CONVENIENCE HELPER
//    ------------------------------------------------------------
//    For call sites that only have `db` + `modelName` and haven't
//    already fetched dmmf themselves (e.g. controller.js's
//    create/update/delete paths). Fetches + caches dmmf internally
//    (getModelMeta already caches per-db lookups upstream).
// ============================================================ */
// export const flattenResponseFor = async (data = [], db, modelName) => {
//   const dmmf = await getModelMeta(db);
//   return flattenResponse(data, modelName, dmmf);
// };


import { getModelMeta } from "./dynamicInclude.js";

/**
 * ============================================================
 * BUILD FK MAP
 * ============================================================
 *
 * Finds:
 *
 * relation field -> FK scalar field
 *
 * Example:
 *
 * dy_user_roles
 *
 * role relation
 *   ↓
 * role_id
 *
 * Result:
 *
 * {
 *   role: "role_id"
 * }
 *
 * ============================================================
 */
const buildFkMap = (modelName, dmmf) => {
  const map = {};

  if (!dmmf?.datamodel?.models) {
    return map;
  }

  const model = dmmf.datamodel.models.find(
    (m) => m.name === modelName
  );

  if (!model) {
    return map;
  }

  model.fields.forEach((field) => {
    if (
      field.kind === "object" &&
      Array.isArray(field.relationFromFields) &&
      field.relationFromFields.length === 1
    ) {
      map[field.name] = field.relationFromFields[0];
    }
  });

  return map;
};


/**
 * ============================================================
 * FLATTEN RECORD
 * ============================================================
 *
 * IMPORTANT:
 *
 * OLD:
 *
 * role_id: "Owner"
 *
 * NEW:
 *
 * role_id: 1
 * role: "Owner"
 *
 * We NEVER replace the FK ID anymore.
 *
 * ============================================================
 */
export const flattenRecord = (
  item,
  modelName,
  dmmf
) => {
  if (!item || typeof item !== "object") {
    return item;
  }

  const fkMap = buildFkMap(modelName, dmmf);

  const flat = {};

  /**
   * Keep track of FK fields.
   *
   * Example:
   *
   * {
   *   role: "role_id"
   * }
   */
  const fkScalars = new Set(
    Object.values(fkMap)
  );

  /**
   * ==========================================================
   * FIRST PASS
   * ==========================================================
   *
   * Copy all scalar fields.
   *
   * This is important because:
   *
   * role_id = 1
   *
   * must remain 1.
   */
  for (const [key, value] of Object.entries(item)) {
    if (key in fkMap) {
      // Relation object is processed later.
      continue;
    }

    /**
     * Keep scalar FK values.
     *
     * Example:
     *
     * role_id: 1
     */
    flat[key] = value;
  }

  /**
   * ==========================================================
   * SECOND PASS
   * ==========================================================
   *
   * Process Prisma relation objects.
   */
  for (const [relationName, relationValue] of Object.entries(item)) {

    /**
     * Not a relation.
     */
    if (!(relationName in fkMap)) {
      continue;
    }

    const fkField = fkMap[relationName];

    /**
     * ========================================================
     * NULL RELATION
     * ========================================================
     */
    if (
      relationValue === null ||
      relationValue === undefined
    ) {
      /**
       * Keep original FK.
       *
       * Example:
       *
       * role_id: null
       */
      if (!(fkField in flat)) {
        flat[fkField] =
          item[fkField] ?? null;
      }

      continue;
    }

    /**
     * ========================================================
     * TO-MANY RELATION
     * ========================================================
     *
     * Example:
     *
     * roles: []
     *
     * We don't flatten arrays into the root object.
     *
     * But we also don't overwrite FK values.
     */
    if (Array.isArray(relationValue)) {
      continue;
    }

    /**
     * ========================================================
     * TO-ONE RELATION
     * ========================================================
     *
     * Example:
     *
     * role: {
     *   id: 1,
     *   role: "Owner"
     * }
     */

    if (
      typeof relationValue !== "object"
    ) {
      continue;
    }

    /**
     * --------------------------------------------------------
     * IMPORTANT FIX
     * --------------------------------------------------------
     *
     * NEVER replace:
     *
     * role_id = 1
     *
     * with:
     *
     * role_id = "Owner"
     *
     * Keep the original FK.
     */
    if (!(fkField in flat)) {
      flat[fkField] =
        item[fkField] ?? null;
    }

    /**
     * ========================================================
     * MERGE RELATION FIELDS
     * ========================================================
     *
     * role:
     * {
     *   id: 1,
     *   role: "Owner"
     * }
     *
     * becomes:
     *
     * role_id: 1
     * role: "Owner"
     *
     * id is skipped because FK already represents it.
     */
    for (
      const [nestedKey, nestedValue]
      of Object.entries(relationValue)
    ) {

      if (nestedKey === "id") {
        continue;
      }

      /**
       * Don't overwrite an existing root field.
       */
      if (!(nestedKey in flat)) {
        flat[nestedKey] =
          nestedValue;
      }
    }
  }

  return flat;
};


/**
 * ============================================================
 * FLATTEN RESPONSE
 * ============================================================
 */
export const flattenResponse = (
  data = [],
  modelName,
  dmmf
) => {

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item) =>
    flattenRecord(
      item,
      modelName,
      dmmf
    )
  );
};


/**
 * ============================================================
 * FLATTEN RESPONSE FOR
 * ============================================================
 *
 * Used by controllers where only db + modelName are available.
 * ============================================================
 */
export const flattenResponseFor = async (
  data = [],
  db,
  modelName
) => {

  const dmmf = await getModelMeta(db);

  return flattenResponse(
    data,
    modelName,
    dmmf
  );
};