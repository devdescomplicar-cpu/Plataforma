import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import {
  getBrands,
  getModels,
  getYears,
  getFipePrice,
} from '../services/fipe-api.service.js';

export const getFipeBrands = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type } = req.query;
    
    if (!type || (type !== 'carros' && type !== 'motos')) {
      res.status(400).json({
        success: false,
        error: { message: 'Tipo de veículo inválido. Use "carros" ou "motos"' },
      });
      return;
    }
    
    const brands = await getBrands(type as 'carros' | 'motos');
    
    res.json({
      success: true,
      data: brands,
    });
  } catch (error) {
    next(error);
  }
};

export const getFipeModels = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type, brandId } = req.query;
    
    if (!type || (type !== 'carros' && type !== 'motos')) {
      res.status(400).json({
        success: false,
        error: { message: 'Tipo de veículo inválido' },
      });
      return;
    }
    
    if (!brandId || typeof brandId !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'ID da marca é obrigatório' },
      });
      return;
    }
    
    const models = await getModels(type as 'carros' | 'motos', brandId);
    
    res.json({
      success: true,
      data: models,
    });
  } catch (error) {
    next(error);
  }
};

export const getFipeYears = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type, brandId, modelId } = req.query;
    
    if (!type || (type !== 'carros' && type !== 'motos')) {
      res.status(400).json({
        success: false,
        error: { message: 'Tipo de veículo inválido' },
      });
      return;
    }
    
    if (!brandId || typeof brandId !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'ID da marca é obrigatório' },
      });
      return;
    }
    
    if (!modelId || typeof modelId !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'ID do modelo é obrigatório' },
      });
      return;
    }
    
    const years = await getYears(type as 'carros' | 'motos', brandId, modelId);
    
    // Processar anos para extrair apenas o número (ex: "2020 Gasolina" -> "2020")
    const processedYears = years.map(year => ({
      ...year,
      nome: year.nome.split(' ')[0], // Extrair apenas o primeiro token (ano)
    }));
    
    res.json({
      success: true,
      data: processedYears,
    });
  } catch (error) {
    next(error);
  }
};

export const getFipePriceData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type, brandId, modelId, yearId } = req.query;
    
    if (!type || (type !== 'carros' && type !== 'motos')) {
      res.status(400).json({
        success: false,
        error: { message: 'Tipo de veículo inválido' },
      });
      return;
    }
    
    if (!brandId || typeof brandId !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'ID da marca é obrigatório' },
      });
      return;
    }
    
    if (!modelId || typeof modelId !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'ID do modelo é obrigatório' },
      });
      return;
    }
    
    if (!yearId || typeof yearId !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'ID do ano é obrigatório' },
      });
      return;
    }
    
    const priceData = await getFipePrice(
      type as 'carros' | 'motos',
      brandId,
      modelId,
      yearId
    );
    
    res.json({
      success: true,
      data: priceData,
    });
  } catch (error) {
    next(error);
  }
};
