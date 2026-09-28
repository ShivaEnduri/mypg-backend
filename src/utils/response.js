


const sendResponse = (res, options = {}) => {
  const {
    status = 200,
    success = true,
    message = "OK",
    data,
    result,
    error = null,
    source = "db",
    count
  } = options;

  // ✅ pick result first, then data
  const finalResult =
    result !== undefined
      ? result
      : data !== undefined
      ? data
      : [];

  return res.status(Number(status)).json({
    success,
    source,
    count:
      count !== undefined
        ? count
        : Array.isArray(finalResult)
        ? finalResult.length
        : finalResult
        ? 1
        : 0,
    result: finalResult,
    ...(error && { error })
  });
};

export default sendResponse;