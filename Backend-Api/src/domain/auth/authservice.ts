import { User } from "@/domain/auth/authmodel"
import { hashedPassword } from "@/config/password";
import AuditLogger from "../audit/audit.service";
import { Model } from "mongoose";



class userService {

    private userModel: Model<User> = User;

    /**
   * Registers a new user
   * @param name User's name
   * @param email User email
   * @param password Plain text password
   * @param ip Optional IP for audit logging
   * @param userAgent Optional User-Agent for audit logging
   */

    public async Register(name: string, email: string, password: string, ip?: string, userAgent?: string) {
        const alreadyExist = await this.userModel.findOne({ email })

        if (alreadyExist) {
            await AuditLogger.logEvent({
                userId: "",
                action: "USER_REGISTER_ATTEMPT",
                status: "DUPLICATE_EMAIL",
                ip: ip,
                userAgent: userAgent,
                metadata: { email: email }

            })
            throw new Error("Error ")
        }

        const pass = hashedPassword(password)
        const newUser = await this.userModel.create({
            name,
            email,
            password: pass
        })
        
        return {
            user: newUser
        }
    }


}

export default userService; 