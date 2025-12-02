import React, { useState } from "react";
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
import { userAPI } from "../utils/api";

export default function Dashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activityFeedOpen, setActivityFeedOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState("dashboard");
    const [showAddChore, setShowAddChore] = useState(false);
    const [user, setUser] = useState({ name: "Loading..." });

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
        { name: "My Chores", icon: ListTodo, active: currentPage === "my-chores", page: "my-chores" },
        { name: "Household Chores", icon: Users, active: false, page: null },
        { name: "Schedule", icon: Calendar, active: false, page: null },
        { name: "Leaderboard", icon: Trophy, active: false, page: null },
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

    // TODO: Fetch my chores from API
    const myChores = [
        {
            id: 1,
            name: "Take Out Trash",
            dueDate: "Today, 8:00 PM",
            effort: 5,
            priority: "high",
        },
        {
            id: 2,
            name: "Clean Bathroom",
            dueDate: "Tomorrow, 10:00 AM",
            effort: 15,
            priority: "medium",
        },
        {
            id: 3,
            name: "Vacuum Living Room",
            dueDate: "Dec 25, 2:00 PM",
            effort: 10,
            priority: "low",
        },
    ];

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

                            {/* My Chores Section */}
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
                                    }}>My Chores</h3>
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
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                                    gap: "16px"
                                }}>
                                    {myChores.map((chore) => (
                                        <ChoreCard key={chore.id} {...chore} />
                                    ))}
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
                        <MyChoresPage onBack={() => setCurrentPage("dashboard")} />
                    ) : currentPage === "roommates" ? (
                        <RoommatesPage onBack={() => setCurrentPage("dashboard")} />
                    ) : currentPage === "ai-chatbot" ? (
                        <AIChatbotPage onBack={() => setCurrentPage("dashboard")} />
                    ) : null}
                </main>
            </div>

            {/* Add Chore Modal */}
            {showAddChore && (
                <AddChoreModal onClose={() => setShowAddChore(false)} />
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
function ChoreCard({ name, dueDate, effort, priority }) {
    const priorityColors = {
        high: "#ef4444",
        medium: "#f59e0b",
        low: "#10b981"
    };

    return (
        <Card>
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
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>{dueDate}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>{effort} min effort</span>
                </div>
                <button style={{
                    width: "100%",
                    marginTop: "16px",
                    padding: "8px",
                    backgroundColor: "#7c3aed",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600"
                }}>
                    Mark Complete
                </button>
            </div>
        </Card>
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
function MyChoresPage({ onBack }) {
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
            <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>My Chores</h2>
        </div>
    );
}

function RoommatesPage({ onBack }) {
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
            <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>Roommates</h2>
        </div>
    );
}

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

// Add Chore Modal
function AddChoreModal({ onClose }) {
    return (
        <>
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    zIndex: 50
                }}
                onClick={onClose}
            />
            <div style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 51,
                width: "90%",
                maxWidth: "500px"
            }}>
                <Card>
                    <div style={{ padding: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                            <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#111827" }}>Add New Chore</h3>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: "8px",
                                    backgroundColor: "transparent",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                            >
                                <X style={{ width: "20px", height: "20px" }} />
                            </button>
                        </div>
                        <p style={{ color: "#6b7280", fontSize: "14px" }}>Add chore form would go here...</p>
                        <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
                            <button style={{
                                flex: 1,
                                padding: "12px 24px",
                                backgroundColor: "#7c3aed",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "600"
                            }}>
                                Add Chore
                            </button>
                            <button onClick={onClose} style={{
                                flex: 1,
                                padding: "12px 24px",
                                backgroundColor: "white",
                                color: "#374151",
                                border: "2px solid #e5e7eb",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "600"
                            }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </Card>
            </div>
        </>
    );
}