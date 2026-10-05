import mongoose from "mongoose";

// Runs fn in a transaction. fn may be retried on transient errors, so it must
// only write through the session and return its result instead of responding.
export const inTransaction = async (fn) => {
  let result;
  await mongoose.connection.transaction(async (session) => {
    result = await fn(session);
  });
  return result;
};
