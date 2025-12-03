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
} from "lucide-react";
import { userAPI, choresAPI } from "../utils/api";
import ChoreDetailModal from "../components/ChoreDetailModal";
import AddChoreModal from "../components/AddChoreModal";
import MyChoresPage from "./MyChoresPage";
import RoommatesPage from "./RoommatesPage";

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
                const userData = await userAPI.getUserProfile();
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
        { name: "My Chores", icon: ListTodo, active: currentPage === "my-i", page: "my-chores" },
        { name: "Household Chores", icon: Users, active: false, page: null },
        { name: "Roommates", icon: Users, active: currentPage === "roommates", page: "roommates" },
        { name: "AI Chatbot", icon: Trophy, active: currentPage === "ai-chatbot", page: "ai-chatbot" },
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

                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <IconButton style={{ position: "relative" }}>
                                <Bell style={{ width: "20px", height: "20px" }} />
                                <span style={{
                                    position: "absolute",
                                    top: "4px",
                                    right: "4px",
                                    width: "8px",
                                    height: "8px",
                                    backgroundColor: "#ef4444",
                                    borderRadius: "50%"
                                }} />
                            </IconButton>
                            <Avatar
                                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop"
                                alt="JD"
                                size="36px"
                            />
                        </div>
                    </div>
                </header>

                {/* Main Dashboard Content */}
                <main style={{ flex: 1, overflow: "auto", padding: "32px" }}>
                    {currentPage === "dashboard" ? (
                        <div>
                            {/* Stats Cards */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                                gap: "24px",
                                marginBottom: "32px"
                            }}>
                                {stats.map((stat, index) => (
                                    <StatCard key={index} {...stat} />
                                ))}
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

                            {/* All Household Chores Table */}
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
                                        All Household Chores
                                    </h3>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button style={{
                                            padding: "8px 16px",
                                            backgroundColor: "white",
                                            color: "#374151",
                                            border: "2px solid #e5e7eb",
                                            borderRadius: "8px",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                            fontWeight: "600"
                                        }}>
                                            Filter
                                        </button>
                                        <button style={{
                                            padding: "8px 16px",
                                            backgroundColor: "white",
                                            color: "#374151",
                                            border: "2px solid #e5e7eb",
                                            borderRadius: "8px",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                            fontWeight: "600"
                                        }}>
                                            Sort
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
                            onCompleteChore={(choreId) => {
                                setCompletedChores([...completedChores, choreId]);
                            }}
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
    const chores = [
        { name: "Take Out Trash", assignee: "John Doe", dueDate: "Today, 8:00 PM", status: "Pending" },
        { name: "Clean Bathroom", assignee: "Jane Smith", dueDate: "Tomorrow", status: "In Progress" },
        { name: "Vacuum Living Room", assignee: "John Doe", dueDate: "Dec 25", status: "Completed" },
    ];

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
                        {chores.map((chore, index) => (
                            <tr key={index} style={{ borderBottom: "1px solid #e5e7eb" }}>
                                <td style={{ padding: "12px 16px", fontSize: "14px", color: "#111827" }}>{chore.name}</td>
                                <td style={{ padding: "12px 16px", fontSize: "14px", color: "#6b7280" }}>{chore.assignee}</td>
                                <td style={{ padding: "12px 16px", fontSize: "14px", color: "#6b7280" }}>{chore.dueDate}</td>
                                <td style={{ padding: "12px 16px" }}>
                                    <span style={{
                                        padding: "4px 8px",
                                        borderRadius: "12px",
                                        fontSize: "12px",
                                        backgroundColor: chore.status === "Completed" ? "#d1fae5" : "#fef3c7",
                                        color: chore.status === "Completed" ? "#065f46" : "#92400e"
                                    }}>
                                        {chore.status}
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


function AIChatbotPage({ onBack }) {
    return (
        <div>
            <button onClick={onBack} style={{
                padding: "8px 16px",
                marginBottom: "16px",
                backgroundColor: "white",
                color: "#374151",
                border: "2px solid #e5e7eb",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600"
            }}>
                ← Back
            </button>
            <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>AI Chatbot</h2>
        </div>
    );
}