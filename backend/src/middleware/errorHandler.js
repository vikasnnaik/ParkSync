/**
 * Centralized Express Error Handler
 */
const errorHandler = (err, req, res, next) => {
  console.error('[ParkSync Error]:', err);

  // MySQL specific errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'A duplicate record already exists with the provided unique identifier (e.g., email, phone, or registration number).',
      detail: err.sqlMessage
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Referenced entity does not exist (Foreign Key Constraint Failed).',
      detail: err.sqlMessage
    });
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({
      success: false,
      message: 'Cannot delete or modify record because it is referenced by other existing data.',
      detail: err.sqlMessage
    });
  }

  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return res.status(400).json({
      success: false,
      message: 'Database check constraint violated.',
      detail: err.sqlMessage
    });
  }

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

module.exports = errorHandler;

