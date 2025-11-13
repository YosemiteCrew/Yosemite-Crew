import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { sanitizeInput } from '../utils/sanitize';
import { NextFunction, Request, Response } from 'express';


export function validateAndSanitizeDTO(DTOClass: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1️⃣ Sanitize request payloads
      req.body = sanitizeInput(req.body);
      req.query = sanitizeInput(req.query);
      req.params = sanitizeInput(req.params);

      // 2️⃣ Transform into DTO (drops unknown fields)
      const dtoObject = plainToInstance(DTOClass, req.body, {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
      });

      // 3️⃣ Validate DTO
      const errors = await validate(dtoObject, {
        whitelist: true,
        forbidNonWhitelisted: true,
        skipMissingProperties: false,
      });

      if (errors.length > 0) {
        const formatted = errors.map((e) => ({
          property: e.property,
          constraints: e.constraints,
        }));
        return res.status(400).json({
          message: 'Validation failed',
          errors: formatted,
        });
      }

      // 4️⃣ Replace req.body with validated DTO instance
      req.body = dtoObject;
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        message: 'Internal validation error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}