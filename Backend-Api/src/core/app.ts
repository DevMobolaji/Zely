import express, { Application } from 'express';
import Controller from "@/interfaces/controller.interfaces"


class App {
    public express: Application;
    public port: number;

    constructor(public controllers: Controller[], port: number) {
        this.express = express()
        this.port = port;

        this.initializeMiddleware();
        this.initializeRoutes(controllers);
        this.initializeGraphql();
        this.initializeErrorMiddleware();
        this.initializeDbConnection()
    }

        private initializeMiddleware(): void {
            this.express.use(express.json());
        }

        private initializeRoutes(controllers: Controller[]): void {
            controllers.forEach(controller => {
                this.express.use('/api/V1', controller.route);
            });
        }

        private initializeGraphql(): void {
        }

        private initializeErrorMiddleware(): void {
            
        }

        public async initializeDbConnection(): Promise<void> {
    // await DbConn(); // implement your DB connection logic here
        }

        public listen(): void {
            this.express.listen(this.port, () => {
                console.log(`🚀 Server running on port ${this.port}`);
            });
        }
}

export default App;