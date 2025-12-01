import { useState, useEffect } from 'react';
import LoginPage from './pages/loginPage.jsx';
import HouseholdSelection from './pages/houseHoldSelection.jsx';
import CreateHousehold from './pages/createHouseHold.jsx';
import WaitingForRoomatesPage from './pages/waitingForRoomatePage.jsx';
import SurveyFlow from './pages/surveyFlow.jsx';
import GeneratedSchedulePage from './pages/generatedSchedulePage.jsx';
import { authAPI, userAPI } from './utils/api';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('household-selection');
  const [isHovered, setIsHovered] = useState(false);
  // Remove roommates state - not needed anymore
  // const [roommates, setRoommates] = useState([]);
  const [isCheckingHousehold, setIsCheckingHousehold] = useState(false);

  // Check if user is already logged in on mount and has a household
  useEffect(() => {
    const checkAuthAndHousehold = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        setIsCheckingHousehold(true);
        try {
          const userInfo = await userAPI.getCurrentUser();
          if (userInfo.house_id) {
            // User has a household, go directly to main dashboard
            setIsLoggedIn(true);
            setCurrentView('main');
          } else {
            // User doesn't have a household, show household selection
            setIsLoggedIn(true);
            setCurrentView('household-selection');
          }
        } catch (error) {
          console.error('Error checking user household:', error);
          // If token is invalid, clear it and show login
          localStorage.removeItem('auth_token');
          setIsLoggedIn(false);
        } finally {
          setIsCheckingHousehold(false);
        }
      }
    };

    checkAuthAndHousehold();
  }, []);

  const handleLogin = async (isNewUser) => {
    console.log('User logged in:', isNewUser ? 'New User' : 'Existing User');
    setIsLoggedIn(true);
    
    // Check if user has a household
    setIsCheckingHousehold(true);
    try {
      const userInfo = await userAPI.getCurrentUser();
      if (userInfo.house_id) {
        // User has a household, skip household creation and go to main dashboard
        setCurrentView('main');
      } else {
        // User doesn't have a household, show household selection
        setCurrentView('household-selection');
      }
    } catch (error) {
      console.error('Error checking user household:', error);
      // If there's an error, default to household selection
      setCurrentView('household-selection');
    } finally {
      setIsCheckingHousehold(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if API call fails
    } finally {
      setIsLoggedIn(false);
      setCurrentView('household-selection');
    }
  };

  const handleCreateHousehold = () => {
    setCurrentView('create');
  };

  const handleJoinHousehold = () => {
    console.log('Joining household...');
    setCurrentView('survey-flow');
  };

  const handleBackToSelection = () => {
    setCurrentView('household-selection');
  };

  const handleCompleteHouseholdSurvey = () => {
    console.log('Household survey completed');
    setCurrentView('generated-schedule');
  };

  const handleCompleteSetup = (householdData) => {
    console.log('Household created:', householdData);
    // Don't need to set roommates anymore
    setCurrentView('survey-flow');
  };

  const handleCompleteOnboarding = (householdData) => {
    console.log('Onboarding completed:', householdData);
    setCurrentView('waiting-for-roomates');
  };

  const handleCompleteGeneratedSchedule = (chores) => {
    console.log(chores);
    setCurrentView('main');
  };

  // Show loading state while checking household
  if (isCheckingHousehold) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #faf5ff, #faf5ff, #f3e8ff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px",
            height: "48px",
            border: "4px solid #f3e8ff",
            borderTop: "4px solid #7c3aed",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px"
          }}></div>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (currentView === 'household-selection') {
    return (
      <HouseholdSelection
        onCreateHousehold={handleCreateHousehold}
        onJoinHousehold={handleJoinHousehold}
      />
    );
  }

  if (currentView === 'create') {
    return (
      <CreateHousehold
        onComplete={handleCompleteSetup}
        onBack={handleBackToSelection}
      />
    );
  }

  if (currentView === 'survey-flow') {
    return (
      <SurveyFlow
        onComplete={handleCompleteOnboarding}
        onBack={handleBackToSelection}
      />
    );
  }

  if (currentView === 'waiting-for-roomates') {
    return (
      <WaitingForRoomatesPage
        // Remove roommates prop - let it fetch from API
        onContinue={handleCompleteHouseholdSurvey}
      />
    );
  }

  if (currentView === 'generated-schedule') {
    return (
      <GeneratedSchedulePage
        onAccept={handleCompleteGeneratedSchedule}
        onAdjust={handleBackToSelection}
      />
    );
  }

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{
        fontSize: '30px',
        fontWeight: 'bold',
        marginBottom: '16px',
        color: '#111827'
      }}>
        Welcome to ChoreMate!
      </h1>
      <p style={{
        color: '#6b7280',
        marginBottom: '16px',
        fontSize: '16px'
      }}>
        You're now part of a household.
      </p>
      <button
        onClick={handleLogout}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          padding: '8px 16px',
          backgroundColor: isHovered ? '#6d28d9' : '#7c3aed',
          color: 'white',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          transition: 'background-color 0.2s',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default App;