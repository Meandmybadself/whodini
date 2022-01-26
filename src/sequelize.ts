import { Sequelize } from "sequelize-typescript";
import path from "path";

export default class DB {
    sequelize: Sequelize;
    async init() {
        console.log("DB: Initializing")
        const sequelize = new Sequelize({
            dialect: "postgres",
            database: process.env.DB_DATABASE,
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            logging: process.env.SILENT !== "1",
            models: [path.resolve(__dirname, "models")],
            ssl: true,
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                }
            },
        });
        try {
            console.log("DB: Authenticating")
            await sequelize.authenticate();
        } catch (e) {
            console.error('Unable to connect to database. Exiting.')
            console.error(e)
            process.exit(1)
        }

        console.log("DB: Connected");
        this.sequelize = sequelize;

        await sequelize.authenticate();
        if (process.env.DB_INIT_BASE_TABLES === "1") {
            console.log("DB: Dropping / adding tables.")
            await sequelize.sync({ force: true });
        } else {
            console.log("DB: Altering tables.");
            await sequelize.sync({ alter: true });
        }
    }
}
