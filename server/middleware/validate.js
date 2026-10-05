// Replaces req.body with the parsed data, or answers 400. Pass `message` to
// answer { message } instead of { message, errors } for screens that only
// read `message`.
export const validateBody =
  (schema, { message } = {}) =>
  (req, res, next) => {
    const parsed = schema.safeParse(req.body ?? {});

    if (!parsed.success) {
      return res.status(400).json(
        message
          ? { message }
          : { message: parsed.error.issues[0].message, errors: parsed.error.issues },
      );
    }

    req.body = parsed.data;
    next();
  };
