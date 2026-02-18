import { config } from './index';

class PepperService {
    private static instance: string | null = null;
    static getPepper(): string {
        if(!PepperService.instance) {
      const pepper = config.pepper;
      if (!pepper) {
        throw new Error("PEPPER environment variable not set");
      }
      PepperService.instance = pepper;
    }
    return PepperService.instance;
    }
}

export default PepperService;