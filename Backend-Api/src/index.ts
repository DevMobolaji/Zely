import 'dotenv/config';
import App from './infrastructure/app';
import AuthController from 'modules/auth/authcontroller';
import { config } from './config';

const app = new App([new AuthController()], Number(config.app.port))


const start = async () => {
     await app.initialize(); 
     app.listen()
}

start()