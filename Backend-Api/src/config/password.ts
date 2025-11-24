import argon2 from "argon2"
import PepperService from "./pepper";


const argonHashOptions = {
        type: argon2.argon2id,
        memoryCost:  2 ** 16,
        timeCost: 3,
        parallelism: 1 
    }

    
    //THIS FUNCTION HASHES THE PASSWORD 

export const hashedPassword = async (plainPass: string): Promise<string> => {
    const pepper = PepperService.getPepper();
    return await argon2.hash(plainPass + pepper, argonHashOptions)
   }

export const verifyPassword = async (plainPass: string, HashedPass: string): Promise<boolean> => {
    
    try {
        return await argon2.verify(plainPass, HashedPass)
    } catch(err) {
        return false
    }
}
