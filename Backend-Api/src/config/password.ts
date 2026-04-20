import argon2 from "argon2"
import PepperService from "./pepper";


const argonHashOptions = {
        type: argon2.argon2id,
        memoryCost: 65536, //2 ** 16,
        timeCost: 3,
        parallelism: 4 
    }

    
//THIS FUNCTION HASHES THE PASSWORD 
const pepper = PepperService.getPepper();

export const hashedPassword = async (plainPass: string): Promise<string> => {
    return await argon2.hash(plainPass + pepper, argonHashOptions)
   }

export const verifyPassword = async (plainPass: string, HashedPass: string): Promise<boolean> => {
    
    try {
        return await argon2.verify(HashedPass, plainPass + pepper,)
    } catch(err) {
        return false
    }
}
