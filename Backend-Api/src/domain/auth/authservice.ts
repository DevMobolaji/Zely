import User from "@/domain/auth/authmodel"
import { hashedPassword } from "@/config/password";
import AuditLogger from "../audit/audit.service";
import { IRequestContext } from "@/interfaces/RequestContext";
import BadRequestError from "@/core/errors/badRequest";



class userService {

    private userModel = User

    /**
   * Registers a new user
   * @param name User's name
   * @param email User email
   * @param password Plain text password
   * @param ip Optional IP for audit logging
   * @param userAgent Optional User-Agent for audit logging
   */

    public async Register(
        name: string, 
        email: string, 
        password: string, 
        context: IRequestContext
    ) {
        const alreadyExist = await this.userModel.findOne({ email })

        if (alreadyExist) {
            const UserId = alreadyExist._id.toString()
            await AuditLogger.logRegistrationAttempt(context, UserId,"REGISTRATION_BLOCKED_ALREADY_EXISTS");
            throw new BadRequestError("User already Exist with that email")
        }

        const newUser = await this.userModel.create({
            name,
            email,
            password
        })
        await AuditLogger.logRegistrationAttempt(context, newUser._id.toString(),"REGISTRATION_SUCCESS");
        
        return {
            user: newUser
        }
    }
}


export default userService; 