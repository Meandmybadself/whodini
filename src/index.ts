import bodyParser from 'body-parser'
import cors from 'cors'
import express, { Request, Response } from 'express'
import helmet from 'helmet'
import Whodini from './whodini'
import DB from './sequelize'
import axios from 'axios'
import getInstallationProvider from './slack/install-provider'

const { HOSTNAME } = process.env
const APPLICATION_NAME: string = 'profile';

(async () => {
    const db = new DB()
    await db.init()

    const installer = getInstallationProvider()
    const whodini = new Whodini()

    const app = express()
    app.use(helmet());
    app.use(cors())
    app.use(bodyParser.urlencoded({ extended: false }))
    app.use(bodyParser.json())

    app.get("/", (_request: Request, response: Response): Response => response.status(200).send(APPLICATION_NAME))

    app.post("/", async (request: Request, response: Response): Promise<Response> => {
        const required = ['token', 'team_id', 'user_id', 'text']
        console.log('/', request.body)
        if (required.some(r => request.body[r] === undefined)) {
            response.status(400).send("Missing required parameters")
            return
        }
        const responseData = await whodini.parseCommand(request.body)
        console.log('responseData', JSON.stringify(responseData, null, 2))
        return response.status(200).json(responseData)
    })

    app.get('/install', async (_request: Request, response: Response): Promise<void> => {
        const url = await installer.generateInstallUrl({
            scopes: ["chat:write",
                "chat:write.public",
                "commands",
                "users:read",
                "users:read.email",
                "users.profile:read"],
            redirectUri: `${HOSTNAME}/oauth`
        })
        return response.redirect(url)
    })

    app.get('/oauth', async (request: Request, response: Response): Promise<void> => installer.handleCallback(request, response))

    app.post('/action', async (request: Request, response: Response): Promise<Response> => {
        const payload = JSON.parse(request.body.payload)

        let responseData

        switch (payload?.type) {
            case 'view_submission':
                responseData = await whodini.parseViewSubmission(payload)
                return response.status(200).json(responseData)
                break;
            default:
                // Edit button clicked – showing modal.
                const responseURL = payload.response_url
                responseData = await whodini.parseAction(payload)
                if (responseData && responseData !== {}) {
                    console.log("Responding via API", JSON.stringify(responseData))
                    axios.post(responseURL, responseData)
                    return
                }
                break;
        }

        console.log("Announcing success")
        return response.status(200)
    })

    const port = process.env.PORT || 3000
    app.listen(port, () => {
        console.log(`Webservice: http://127.0.0.1:${port}`)
        if (process.env.PREPUSH_CHECK) {
            console.log("✅ prepush check - Successfully started. Exiting.");
            process.exit();
        }
    })
})()