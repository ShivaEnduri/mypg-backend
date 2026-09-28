



import { PrismaClient as PgClient } from "../../generated/pg/index.js";


const clients = {
  pg: new PgClient(),
 
};

export default function getDB(db = "pg") {

  const key = db.toLowerCase(); // ✅ normalize

  switch (key) {
    case "pg":
    case "mypg":
    case "default":
      return clients.pg;

    
    
    default:
      throw new Error(`Database "${db}" not found`);
  }
}