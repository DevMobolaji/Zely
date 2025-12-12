import React, { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-gray-100">
      {currentScreen === 'login' ? (
        <LoginScreen onSwitchToRegister={() => setCurrentScreen('register')} />
      ) : (
        <RegisterScreen onSwitchToLogin={() => setCurrentScreen('login')} />
      )}
    </div>
  );
};

export default App;