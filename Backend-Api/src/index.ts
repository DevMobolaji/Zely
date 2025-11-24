import 'dotenv/config';
import App from './core/app';
import AuthController from './domain/auth/authcontroller';
import validateEnvVariables from '@/config/validate';

validateEnvVariables();
const app = new App([new AuthController()], Number(process.env.PORT))


const start = async () => {
     app.listen()
}

start ()