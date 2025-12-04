import React from 'react';
import { X, Check, Bell, MessageSquare, Trophy, UserPlus } from 'lucide-react';
import { notificationsAPI } from '../utils/api';

export default function ActivityCenter({ notifications, onClose, onMarkRead, onDismiss }) {
    const handleDismiss = async (e, id) => {
        e.stopPropagation();
        try {
            await notificationsAPI.dismiss(id);
            onDismiss(id);
        } catch (err) {
            console.error("Failed to dismiss notification:", err);
        }
    };

    const handleMarkRead = async (id, isRead) => {
        if (isRead) return;
        try {
            await notificationsAPI.markRead(id);
            onMarkRead(id);
        } catch (err) {
            console.error("Failed to mark notification as read:", err);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'appreciation':
                return <Trophy style={{ width: "20px", height: "20px", color: "#f59e0b" }} />;
            case 'swap_request':
                return <MessageSquare style={{ width: "20px", height: "20px", color: "#3b82f6" }} />;
            case 'invite':
                return <UserPlus style={{ width: "20px", height: "20px", color: "#10b981" }} />;
            default:
                return <Bell style={{ width: "20px", height: "20px", color: "#6b7280" }} />;
        }
    };

    return (
        <div style={{
            position: "absolute",
            top: "60px",
            right: "32px",
            width: "360px",
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e5e7eb",
            zIndex: 50,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 100px)"
        }}>
            {/* Header */}
            <div style={{
                padding: "16px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#f9fafb"
            }}>
                <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>
                    Activity Center
                </h3>
                <button
                    onClick={onClose}
                    style={{
                        padding: "4px",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#6b7280",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "4px"
                    }}
                >
                    <X style={{ width: "16px", height: "16px" }} />
                </button>
            </div>

            {/* Notifications List */}
            <div style={{ overflowY: "auto", flex: 1 }}>
                {notifications.length === 0 ? (
                    <div style={{ padding: "32px", textAlign: "center", color: "#6b7280" }}>
                        <Bell style={{ width: "32px", height: "32px", color: "#d1d5db", marginBottom: "8px" }} />
                        <p style={{ fontSize: "14px" }}>No new notifications</p>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <div
                            key={notification.id}
                            onClick={() => handleMarkRead(notification.id, notification.is_read)}
                            style={{
                                padding: "16px",
                                borderBottom: "1px solid #f3f4f6",
                                backgroundColor: notification.is_read ? "white" : "#f0f9ff",
                                cursor: notification.is_read ? "default" : "pointer",
                                transition: "background-color 0.2s",
                                position: "relative"
                            }}
                        >
                            <div style={{ display: "flex", gap: "12px" }}>
                                <div style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "50%",
                                    backgroundColor: notification.is_read ? "#f3f4f6" : "white",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    border: notification.is_read ? "none" : "1px solid #e5e7eb"
                                }}>
                                    {getIcon(notification.notification_type)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "4px" }}>
                                        <p style={{
                                            fontSize: "14px",
                                            fontWeight: notification.is_read ? "500" : "600",
                                            color: "#111827"
                                        }}>
                                            {notification.title}
                                        </p>
                                        <button
                                            onClick={(e) => handleDismiss(e, notification.id)}
                                            style={{
                                                padding: "4px",
                                                backgroundColor: "transparent",
                                                border: "none",
                                                cursor: "pointer",
                                                color: "#9ca3af",
                                                fontSize: "12px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px"
                                            }}
                                            title="Dismiss"
                                        >
                                            <X style={{ width: "12px", height: "12px" }} />
                                        </button>
                                    </div>
                                    <p style={{ fontSize: "13px", color: "#4b5563", lineHeight: "1.4", marginBottom: "8px" }}>
                                        {notification.message}
                                    </p>
                                    <p style={{ fontSize: "11px", color: "#9ca3af" }}>
                                        {new Date(notification.created_at).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            {!notification.is_read && (
                                <div style={{
                                    position: "absolute",
                                    top: "16px",
                                    right: "16px",
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    backgroundColor: "#3b82f6"
                                }} />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
