import { useState } from 'react';
import LoginPage from './pages/loginPage.jsx';
import HouseholdSelection from './pages/houseHoldSelection.jsx';
import CreateHousehold from './pages/createHouseHold.jsx';
import WaitingForRoomatesPage from './pages/waitingForRoomatePage.jsx';
import SurveyFlow from './pages/surveyFlow.jsx';
import GeneratedSchedulePage from './pages/generatedSchedulePage.jsx';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('household-selection'); // 'household-selection', 'create', 'join', 'main'
  const [isHovered, setIsHovered] = useState(false);
  const [roommates, setRoommates] = useState([]);

  const handleLogin = (isNewUser) => {
    console.log('User logged in:', isNewUser ? 'New User' : 'Existing User');
    setIsLoggedIn(true);
    setCurrentView('household-selection');
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
    setRoommates(householdData.roommates || []);
    console.log('Roommates:', roommates);
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
        roommates={roommates}
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
        onClick={() => {
          setIsLoggedIn(false);
          setCurrentView('household-selection');
        }}
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