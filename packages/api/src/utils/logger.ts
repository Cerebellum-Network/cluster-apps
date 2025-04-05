import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

export const logTransaction = (
  paymentId: string, 
  action: string, 
  status: string, 
  metadata: Record<string, any>
) => {
  logger.info({
    paymentId,
    action,
    status,
    ...metadata,
    timestamp: new Date().toISOString()
  });
};

export default logger; 