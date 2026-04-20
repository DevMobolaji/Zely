import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import useRefreshToken from "../auth/useRefreshToken";
import { useAuth } from "../auth/AuthProvider";
import { Loader2 } from "lucide-react";

const PersistLogin = () => {
  const [isLoading, setIsLoading] = useState(true)
  const refresh = useRefreshToken()
  const { auth } = useAuth()

  useEffect(() => {
    const verifyRefreshToken = async () => {
      try {
        await refresh()
      } catch (error) {
        console.log(error)
      } finally {
        setIsLoading(false)
      }
    }

    !auth?.accessToken ? verifyRefreshToken() : setIsLoading(false)
  }, [])



  return (
    isLoading ? (
      <div className= "h-screen w-full flex items-center justify-center bg-white dark:bg-black text-slate-900 dark:text-white" >
      <div className= "flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300" >
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm font-semibold text-slate-500" > Restoring secure session...</p>
        </div>
        </div>
      ) : (
  <Outlet />
)
  )
}


export default PersistLogin
