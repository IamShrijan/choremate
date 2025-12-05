import React, { useState, useEffect } from "react";
import {
    Home,
    ListTodo,
    Users,
    Calendar,
    Menu,
    Bell,
    Clock,
    Trophy,
    MessageSquare,
    X,
    Plus,
    CheckCircle,
    LogOut,
    Bot
} from "lucide-react";
import ChoreDetailModal from "../components/ChoreDetailModal";
import AddChoreModal from "../components/AddChoreModal";
import MyChoresPage from "./MyChoresPage";
import RoommatesPage from "./RoommatesPage";
import AIChatbotPage from "./AIChatbotPage";
import HouseholdChoresPage from "./HouseholdChoresPage";
import ActivityCenter from "../components/ActivityCenter";
import { userAPI, choresAPI, notificationsAPI, statsAPI } from "../utils/api";

export default function Dashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activityFeedOpen, setActivityFeedOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState("dashboard");
    const [showAddChore, setShowAddChore] = useState(false);
    const [user, setUser] = useState({ name: "Loading..." });
    const [selectedChore, setSelectedChore] = useState(null);
    const [completedChores, setCompletedChores] = useState([]);
    const [allChores, setAllChores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [dashboardStats, setDashboardStats] = useState({
        pending_chores_week: 0,
        completed_chores_week: 0,
        appreciations_month: 0
    });
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState("");

    const handleSignOut = async () => {
        try {
            await userAPI.logout();
            window.location.reload(); // Reload to trigger auth check and redirect to login
        } catch (err) {
            console.error("Logout failed:", err);
            // Force logout anyway
            sessionStorage.removeItem('auth_token');
            window.location.reload();
        }
    };

    const handleSubmitFeedback = async () => {
        if (!feedbackMessage.trim()) return;
        try {
            await userAPI.submitFeedback(feedbackMessage);
        } catch (err) {
            console.error("Failed to submit feedback:", err);
            // Fail silently as requested
        }

        // Always show success message to user
        setFeedbackMessage("");
        setShowFeedbackModal(false);
        alert("Thank you for your feedback!");
    };

    // Fetch notifications and stats
    const fetchNotificationsAndStats = async () => {
        try {
            const [notifs, stats] = await Promise.all([
                notificationsAPI.getNotifications(),
                statsAPI.getDashboardStats()
            ]);

            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.is_read).length);
            setDashboardStats(stats);
        } catch (err) {
            console.error("Error fetching dashboard data:", err);
        }
    };

    useEffect(() => {
        fetchNotificationsAndStats();
        // Poll every minute
        const interval = setInterval(fetchNotificationsAndStats, 60000);
        return () => clearInterval(interval);
    }, []);

    // Fetch chores from API on component mount
    useEffect(() => {
        const fetchChores = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await choresAPI.getChores();

                // Transform API response to match frontend format
                const transformedChores = response.map(ticket => ({
                    id: ticket.ticket_id,
                    name: ticket.chore_name,
                    dueDate: ticket.due_date,
                    effort: ticket.duration,
                    priority: ticket.difficulty_level === 1 ? "low" : ticket.difficulty_level === 2 ? "medium" : "high",
                    assignedTo: ticket.assigned_user_name,
                    frequency: "Daily", // Default value, update if API provides this
                    notes: ticket.notes || "",
                }));

                setAllChores(transformedChores);
            } catch (err) {
                console.error("Error fetching chores:", err);
                setError("Failed to load chores. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchChores();
    }, []);

    React.useEffect(() => {
        const fetchUser = async () => {
            try {
                const userData = await userAPI.getProfile();
                setUser(userData);
            } catch (error) {
                console.error("Failed to fetch user:", error);
                // Fallback or error handling
                setUser({ name: "Guest" });
            }
        };
        fetchUser();
    }, []);

    const handleNavigation = (page) => {
        if (page) {
            setCurrentPage(page);
            setSidebarOpen(false);
        }
    };

    const navigationItems = [
        { name: "Dashboard", icon: Home, active: currentPage === "dashboard", page: "dashboard" },
        { name: "My Chores", icon: ListTodo, active: currentPage === "my-chores", page: "my-chores" },
        { name: "Household Chores", icon: Users, active: currentPage === "household-chores", page: "household-chores" },
        { name: "Roommates", icon: Users, active: currentPage === "roommates", page: "roommates" },
        { name: "ChoreMate AI", icon: Bot, active: currentPage === "ai-chatbot", page: "ai-chatbot" },
    ];

    // TODO: Fetch stats from API
    const stats = [
        {
            title: "My Pending Chores",
            value: "4",
            subtitle: "2 due today",
            trend: "neutral",
        },
        {
            title: "Household Completion",
            value: "20%",
            subtitle: "8/40 completed this week",
            trend: "up",
        },
        {
            title: "Appreciations Received",
            value: "12",
            subtitle: "+3 this week",
            trend: "up",
        },
    ];

    // Filter out completed chores
    const myChores = allChores.filter(chore => !completedChores.includes(chore.id));

    // Filter out completed chores and only show today's chores
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysChores = allChores.filter(chore => {
        if (completedChores.includes(chore.id)) return false;

        const choreDate = new Date(chore.dueDate);
        return choreDate >= today && choreDate < tomorrow;
    });

    // Handler for adding new chore
    const handleAddChore = (newChore) => {
        setAllChores([...allChores, newChore]);
    };

    // Handler for completing a chore - now uses real API
    const handleCompleteChore = async (choreId) => {
        try {
            console.log("Completing chore:", choreId);

            // Call the API to mark ticket as complete
            await choresAPI.markComplete(choreId);

            // Update local state
            setCompletedChores([...completedChores, choreId]);

            // Refresh dashboard stats to reflect the change
            await fetchNotificationsAndStats();

            // Optionally refresh chores from API
            // const updatedChores = await choresAPI.getChores();
            // setAllChores(transformChores(updatedChores));
        } catch (err) {
            console.error("Error completing chore:", err);
            alert("Failed to complete chore. Please try again.");
        }
    };

    // Placeholder function for editing a chore
    const handleEditChore = async (choreId, updatedData) => {
        try {
            console.log("Editing chore:", choreId, updatedData);
            // TODO: Add API call to update chore
            // await choresAPI.updateChore(choreId, updatedData);

            // For now, just update local state
            setAllChores(allChores.map(chore =>
                chore.id === choreId ? { ...chore, ...updatedData } : chore
            ));
        } catch (err) {
            console.error("Error editing chore:", err);
        }
    };

    return (
        <div style={{
            display: "flex",
            minHeight: "100vh",
            backgroundColor: "#f9fafb",
            fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        zIndex: 40,
                        display: window.innerWidth >= 1024 ? "none" : "block"
                    }}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Left Navigation - Sticky Sidebar */}
            <aside style={{
                position: window.innerWidth >= 1024 ? "sticky" : "fixed",
                top: 0,
                bottom: 0,
                left: 0,
                height: window.innerWidth >= 1024 ? "100vh" : "100%",
                zIndex: 50,
                width: "256px",
                backgroundColor: "#581c87",
                color: "white",
                display: "flex",
                flexDirection: "column",
                transform: window.innerWidth >= 1024 ? "translateX(0)" : (sidebarOpen ? "translateX(0)" : "translateX(-100%)"),
                transition: "transform 0.2s ease-in-out",
                overflowY: "auto"
            }}>
                {/* Close button for mobile */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "24px"
                }}>
                    <h1 style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "white"
                    }}>ChoreMate</h1>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        style={{
                            padding: "8px",
                            backgroundColor: "transparent",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: window.innerWidth >= 1024 ? "none" : "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white"
                        }}
                    >
                        <X style={{ width: "20px", height: "20px" }} />
                    </button>
                </div>

                <nav style={{ flex: 1, padding: "0 12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {navigationItems.map((item) => (
                            <NavButton
                                key={item.name}
                                active={item.active}
                                onClick={() => handleNavigation(item.page)}
                                icon={item.icon}
                            >
                                {item.name}
                            </NavButton>
                        ))}
                    </div>

                    <div style={{
                        marginTop: "32px",
                        paddingTop: "24px",
                        borderTop: "1px solid #6b21a8"
                    }}>
                        <p style={{
                            padding: "0 12px",
                            marginBottom: "12px",
                            color: "#d8b4fe",
                            fontSize: "14px"
                        }}>
                            Quick Actions
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <SidebarActionButton
                                onClick={() => setShowAddChore(true)}
                                icon={Plus}
                            >
                                Add Chore
                            </SidebarActionButton>
                            <SidebarActionButton icon={Plus}>
                                Invite Roommate
                            </SidebarActionButton>
                        </div>
                    </div>
                </nav>

                <div style={{
                    padding: "16px",
                    borderTop: "1px solid #6b21a8"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <Avatar
                            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop"
                            alt="JD"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: "white", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {user.name}
                            </p>
                            <p style={{ color: "#d8b4fe", fontSize: "12px" }}>
                                {user.email}
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                {/* Top Bar */}
                <header style={{
                    backgroundColor: "white",
                    borderBottom: "1px solid #e5e7eb",
                    padding: "16px 32px",
                    position: "sticky",
                    top: 0,
                    zIndex: 10
                }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "16px"
                    }}>
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            style={{
                                padding: "8px",
                                backgroundColor: "transparent",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                display: window.innerWidth >= 1024 ? "none" : "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#6b7280"
                            }}
                        >
                            <Menu style={{ width: "20px", height: "20px" }} />
                        </button>

                        <h2 style={{
                            fontSize: "20px",
                            fontWeight: "600",
                            color: "#111827"
                        }}>
                            Welcome {user.name}!
                        </h2>

                        <div style={{ display: "flex", alignItems: "center", gap: "16px", position: "relative" }}>
                            <IconButton
                                onClick={() => setActivityFeedOpen(!activityFeedOpen)}
                                style={{ position: "relative" }}
                            >
                                <Bell style={{ width: "20px", height: "20px" }} />
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: "absolute",
                                        top: "4px",
                                        right: "4px",
                                        width: "8px",
                                        height: "8px",
                                        backgroundColor: "#ef4444",
                                        borderRadius: "50%"
                                    }} />
                                )}
                            </IconButton>

                            {activityFeedOpen && (
                                <ActivityCenter
                                    notifications={notifications}
                                    onClose={() => setActivityFeedOpen(false)}
                                    onMarkRead={(id) => {
                                        setNotifications(prev => prev.map(n =>
                                            n.id === id ? { ...n, is_read: true } : n
                                        ));
                                        setUnreadCount(prev => Math.max(0, prev - 1));
                                    }}
                                    onDismiss={(id) => {
                                        setNotifications(prev => prev.filter(n => n.id !== id));
                                        // If it was unread, decrease count
                                        const notification = notifications.find(n => n.id === id);
                                        if (notification && !notification.is_read) {
                                            setUnreadCount(prev => Math.max(0, prev - 1));
                                        }
                                    }}
                                />
                            )}

                            <div style={{ position: "relative" }}>
                                <button
                                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                    style={{
                                        border: "none",
                                        background: "none",
                                        padding: 0,
                                        cursor: "pointer",
                                    }}
                                >
                                    <Avatar
                                        src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop"
                                        alt="JD"
                                        size="36px"
                                    />
                                </button>

                                {isProfileMenuOpen && (
                                    <div style={{
                                        position: "absolute",
                                        top: "100%",
                                        right: 0,
                                        marginTop: "8px",
                                        width: "200px",
                                        backgroundColor: "white",
                                        borderRadius: "8px",
                                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                                        border: "1px solid #e5e7eb",
                                        zIndex: 50,
                                        overflow: "hidden"
                                    }}>
                                        <button
                                            onClick={() => {
                                                setIsProfileMenuOpen(false);
                                                setShowFeedbackModal(true);
                                            }}
                                            style={{
                                                width: "100%",
                                                textAlign: "left",
                                                padding: "12px 16px",
                                                backgroundColor: "white",
                                                border: "none",
                                                borderBottom: "1px solid #f3f4f6",
                                                cursor: "pointer",
                                                fontSize: "14px",
                                                color: "#374151",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px"
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = "#f9fafb"}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = "white"}
                                        >
                                            <MessageSquare style={{ width: "16px", height: "16px" }} />
                                            Give Feedback
                                        </button>
                                        <button
                                            onClick={handleSignOut}
                                            style={{
                                                width: "100%",
                                                textAlign: "left",
                                                padding: "12px 16px",
                                                backgroundColor: "white",
                                                border: "none",
                                                cursor: "pointer",
                                                fontSize: "14px",
                                                color: "#ef4444",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px"
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = "#fef2f2"}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = "white"}
                                        >
                                            <LogOut style={{ width: "16px", height: "16px" }} />
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Feedback Modal */}
                {showFeedbackModal && (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 60
                    }}>
                        <div style={{
                            backgroundColor: "white",
                            borderRadius: "16px",
                            padding: "24px",
                            width: "100%",
                            maxWidth: "500px",
                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#111827" }}>Give Feedback</h3>
                                <button
                                    onClick={() => setShowFeedbackModal(false)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
                                >
                                    <X style={{ width: "24px", height: "24px" }} />
                                </button>
                            </div>
                            <textarea
                                value={feedbackMessage}
                                onChange={(e) => setFeedbackMessage(e.target.value)}
                                placeholder="Tell us what you think..."
                                style={{
                                    width: "100%",
                                    height: "120px",
                                    padding: "12px",
                                    borderRadius: "8px",
                                    border: "1px solid #d1d5db",
                                    marginBottom: "16px",
                                    resize: "vertical",
                                    fontFamily: "inherit"
                                }}
                            />
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                                <button
                                    onClick={() => setShowFeedbackModal(false)}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: "8px",
                                        border: "1px solid #d1d5db",
                                        backgroundColor: "white",
                                        color: "#374151",
                                        cursor: "pointer",
                                        fontWeight: "500"
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitFeedback}
                                    disabled={!feedbackMessage.trim()}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: "8px",
                                        border: "none",
                                        backgroundColor: feedbackMessage.trim() ? "#7c3aed" : "#c4b5fd",
                                        color: "white",
                                        cursor: feedbackMessage.trim() ? "pointer" : "not-allowed",
                                        fontWeight: "500"
                                    }}
                                >
                                    Submit Feedback
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Dashboard Content */}
                <main style={{ flex: 1, overflow: "auto", padding: "32px" }}>
                    {currentPage === "dashboard" ? (
                        <div>
                            {/* Stats Grid */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                                gap: "24px",
                                marginBottom: "32px"
                            }}>
                                <StatCard
                                    title="Pending Chores"
                                    value={dashboardStats.pending_chores_week}
                                    subtitle="This week"
                                    icon={Clock}
                                    color="#f59e0b"
                                />
                                <StatCard
                                    title="Completed"
                                    value={dashboardStats.completed_chores_week}
                                    subtitle="This week"
                                    icon={CheckCircle}
                                    color="#10b981"
                                />
                                <StatCard
                                    title="Appreciations"
                                    value={dashboardStats.appreciations_month}
                                    subtitle="This month"
                                    icon={Trophy}
                                    color="#8b5cf6"
                                />
                            </div>
                            {/* Today's Chores Section */}
                            <div style={{ marginBottom: "32px" }}>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: "16px"
                                }}>
                                    <h3 style={{
                                        fontSize: "20px",
                                        fontWeight: "600",
                                        color: "#111827"
                                    }}>Today's Chores</h3>
                                    <button
                                        onClick={() => setCurrentPage("my-chores")}
                                        style={{
                                            padding: "8px 16px",
                                            backgroundColor: "white",
                                            color: "#374151",
                                            border: "2px solid #e5e7eb",
                                            borderRadius: "8px",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                            fontWeight: "600"
                                        }}
                                    >
                                        View All
                                    </button>
                                </div>
                                <div style={{
                                    display: "flex",
                                    gap: "16px",
                                    overflowX: "auto",
                                    overflowY: "hidden",
                                    paddingBottom: "8px",
                                    scrollbarWidth: "thin",
                                    scrollbarColor: "#cbd5e1 #f1f5f9",
                                }}>
                                    {todaysChores.length > 0 ? (
                                        todaysChores.map((chore) => (
                                            <div
                                                key={chore.id}
                                                style={{
                                                    minWidth: "calc(33.333% - 11px)",
                                                    maxWidth: "calc(33.333% - 11px)",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <ChoreCard
                                                    {...chore}
                                                    onClick={() => setSelectedChore(chore)}
                                                />
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{
                                            width: "100%",
                                            padding: "32px",
                                            textAlign: "center",
                                            color: "#6b7280",
                                            fontSize: "14px"
                                        }}>
                                            No chores due today! 🎉
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Today's Household Chores Table */}
                            <div>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: "16px"
                                }}>
                                    <h3 style={{
                                        fontSize: "20px",
                                        fontWeight: "600",
                                        color: "#111827"
                                    }}>
                                        Today's Household Chores
                                    </h3>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={() => setCurrentPage("household-chores")}
                                            style={{
                                                padding: "8px 16px",
                                                backgroundColor: "#7c3aed",
                                                color: "white",
                                                border: "none",
                                                borderRadius: "8px",
                                                cursor: "pointer",
                                                fontSize: "14px",
                                                fontWeight: "600"
                                            }}>
                                            View All Household Chores
                                        </button>
                                    </div>
                                </div>
                                <ChoreTable />
                            </div>
                        </div>
                    ) : currentPage === "my-chores" ? (
                        <MyChoresPage
                            onBack={() => setCurrentPage("dashboard")}
                            allChores={allChores}
                            onAddChore={handleAddChore}
                            onCompleteChore={handleCompleteChore}
                            completedChores={completedChores}
                            onRefresh={async () => {
                                // Refetch chores after rescheduling
                                console.log("MyChoresPage onRefresh called");
                                try {
                                    const response = await choresAPI.getChores();
                                    const transformedChores = response.map(ticket => ({
                                        id: ticket.ticket_id,
                                        name: ticket.chore_name,
                                        dueDate: ticket.due_date,
                                        effort: ticket.duration,
                                        priority: ticket.difficulty_level === 1 ? "low" : ticket.difficulty_level === 2 ? "medium" : "high",
                                        assignedTo: ticket.assigned_user_name,
                                        frequency: "Daily",
                                        notes: ticket.notes || "",
                                    }));
                                    setAllChores(transformedChores);
                                    console.log("MyChoresPage state updated");
                                } catch (err) {
                                    console.error("Error refreshing chores in MyChoresPage:", err);
                                }
                            }}
                        />
                    ) : currentPage === "household-chores" ? (
                        <HouseholdChoresPage onBack={() => setCurrentPage("dashboard")} />
                    ) : currentPage === "roommates" ? (
                        <RoommatesPage onBack={() => setCurrentPage("dashboard")} />
                    ) : currentPage === "ai-chatbot" ? (
                        <AIChatbotPage onBack={() => setCurrentPage("dashboard")} />
                    ) : null}
                </main>
            </div>

            {/* Add Chore Modal */}
            {showAddChore && (
                <AddChoreModal
                    onClose={() => setShowAddChore(false)}
                    onAdd={handleAddChore}
                />
            )}

            {/* Chore Detail Modal */}
            {selectedChore && (
                <ChoreDetailModal
                    chore={selectedChore}
                    onClose={() => setSelectedChore(null)}
                    onComplete={handleCompleteChore}
                    onRefresh={async () => {
                        // Refetch chores after rescheduling
                        console.log("Dashboard onRefresh called");
                        try {
                            console.log("Fetching updated chores...");
                            const response = await choresAPI.getChores();
                            console.log("Received chores:", response.length);

                            const transformedChores = response.map(ticket => ({
                                id: ticket.ticket_id,
                                name: ticket.chore_name,
                                dueDate: ticket.due_date,
                                effort: ticket.duration,
                                priority: ticket.difficulty_level === 1 ? "low" : ticket.difficulty_level === 2 ? "medium" : "high",
                                assignedTo: ticket.assigned_user_name,
                                frequency: "Daily",
                                notes: ticket.notes || "",
                            }));

                            console.log("Setting updated chores to state");
                            setAllChores(transformedChores);
                            console.log("State updated successfully");
                        } catch (err) {
                            console.error("Error refreshing chores:", err);
                        }
                    }}
                />
            )}
        </div>
    );
}

// Icon Button Component
function IconButton({ onClick, children, style }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                padding: "8px",
                backgroundColor: isHovered ? "#f3f4f6" : "transparent",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 0.2s",
                color: "#6b7280",
                ...style
            }}
        >
            {children}
        </button>
    );
}

// Navigation Button Component
function NavButton({ active, onClick, icon: Icon, children }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                transition: "background-color 0.2s",
                backgroundColor: active ? "#6b21a8" : (isHovered ? "#7c3aed" : "transparent"),
                color: "white",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                fontFamily: "system-ui, -apple-system, sans-serif",
                textAlign: "left"
            }}
        >
            <Icon style={{ width: "20px", height: "20px" }} />
            <span>{children}</span>
        </button>
    );
}

// Sidebar Action Button Component
function SidebarActionButton({ onClick, icon: Icon, children }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 12px",
                backgroundColor: isHovered ? "#7c3aed" : "#581c87",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background-color 0.2s",
                fontFamily: "system-ui, -apple-system, sans-serif"
            }}
        >
            <Icon style={{ width: "16px", height: "16px" }} />
            {children}
        </button>
    );
}

// Avatar Component
function Avatar({ src, alt, size = "40px" }) {
    return (
        <div style={{
            width: size,
            height: size,
            borderRadius: "50%",
            overflow: "hidden",
            backgroundColor: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
        }}>
            {src ? (
                <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
                <span style={{ color: "#6b7280", fontSize: "14px", fontWeight: "600" }}>{alt}</span>
            )}
        </div>
    );
}

// Card Component
function Card({ children, style }) {
    return (
        <div style={{
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
            backgroundColor: "white",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            ...style
        }}>
            {children}
        </div>
    );
}

// Stat Card Component
function StatCard({ title, value, subtitle, trend }) {
    return (
        <Card>
            <div style={{ padding: "24px" }}>
                <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "8px" }}>{title}</p>
                <p style={{ fontSize: "32px", fontWeight: "bold", color: "#111827", marginBottom: "4px" }}>{value}</p>
                <p style={{ color: "#6b7280", fontSize: "12px" }}>{subtitle}</p>
            </div>
        </Card>
    );
}

// Chore Card Component
function ChoreCard({ name, dueDate, effort, priority, onClick }) {
    const [isHovered, setIsHovered] = useState(false);
    const priorityColors = {
        high: "#ef4444",
        medium: "#f59e0b",
        low: "#10b981"
    };

    const formatDueDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const choreDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (choreDate.getTime() === today.getTime()) {
            return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} `;
        } else if (choreDate.getTime() === tomorrow.getTime()) {
            return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} `;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        }
    };

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                borderRadius: "16px",
                border: "1px solid #e5e7eb",
                backgroundColor: "white",
                boxShadow: isHovered ? "0 4px 12px rgba(0, 0, 0, 0.15)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                transform: isHovered ? "translateY(-2px)" : "translateY(0)",
            }}
        >
            <div style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                    <h4 style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>{name}</h4>
                    <div style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: priorityColors[priority]
                    }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <Clock style={{ width: "14px", height: "14px", color: "#6b7280" }} />
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>{formatDueDate(dueDate)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>{effort} min effort</span>
                </div>
            </div>
        </div>
    );
}

// Chore Table Component
function ChoreTable() {
    const [houseChores, setHouseChores] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        const fetchHouseChores = async () => {
            try {
                setLoading(true);
                setError(null);
                console.log("Fetching house chores...");
                const response = await choresAPI.getChoresByHouse();
                console.log("House chores response:", response);
                console.log("Number of chores:", response?.length);

                // Filter to show only today's chores
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const todaysHouseChores = response.filter(chore => {
                    const choreDate = new Date(chore.dueDate);
                    return choreDate >= today && choreDate < tomorrow;
                });

                console.log("Today's house chores:", todaysHouseChores.length);
                setHouseChores(todaysHouseChores);
            } catch (err) {
                console.error("Error fetching house chores:", err);
                console.error("Error details:", err.message);
                console.error("Error response:", err.response);
                setError(`Failed to load house chores: ${err.message || 'Unknown error'}`);
            } finally {
                setLoading(false);
            }
        };

        fetchHouseChores();
    }, []);

    if (loading) {
        return (
            <Card>
                <div style={{ padding: "32px", textAlign: "center", color: "#6b7280" }}>
                    Loading house chores...
                </div>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <div style={{ padding: "32px", textAlign: "center", color: "#ef4444" }}>
                    {error}
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Chore</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Assignee</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Due Date</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {houseChores.map((chore, index) => (
                            <tr key={index} style={{ borderBottom: "1px solid #e5e7eb" }}>
                                <td style={{ padding: "16px", fontSize: "14px", color: "#111827" }}>
                                    {chore.choreName || chore.name}
                                </td>
                                <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                                    {chore.assignedTo || "Unassigned"}
                                </td>
                                <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                                    {chore.dueDate ? new Date(chore.dueDate).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit"
                                    }) : "No due date"}
                                </td>
                                <td style={{ padding: "16px" }}>
                                    <span style={{
                                        padding: "4px 12px",
                                        borderRadius: "12px",
                                        fontSize: "12px",
                                        fontWeight: "500",
                                        backgroundColor: chore.status === "Completed" ? "#d1fae5" :
                                            chore.status === "In Progress" ? "#fef3c7" : "#fee2e2",
                                        color: chore.status === "Completed" ? "#065f46" :
                                            chore.status === "In Progress" ? "#92400e" : "#991b1b"
                                    }}>
                                        {chore.status || "Pending"}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

// Placeholder Pages
// function MyChoresPage({ onBack }) {
//     return (
//         <div>
//             <button onClick={onBack} style={{
//                 padding: "8px 16px",
//                 marginBottom: "16px",
//                 backgroundColor: "white",
//                 color: "#374151",
//                 border: "2px solid #e5e7eb",
//                 borderRadius: "8px",
//                 cursor: "pointer",
//                 fontSize: "14px",
//                 fontWeight: "600"
//             }}>
//                 ← Back
//             </button>
//             <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>My Chores</h2>
//         </div>
//     );
// }