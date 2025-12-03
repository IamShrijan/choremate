import { useState, useEffect } from "react";
import {
  Clock,
  Calendar,
  CheckCircle,
  Sparkles,
  Trash2,
  Edit2,
  Plus,
  X,
} from "lucide-react";
import Button from "../components/button";
import { Card, CardContent } from "../components/card";
import Input from "../components/input";
import { Textarea } from "../components/textarea";
import { choresAPI, userAPI } from "../utils/api";

// Simple icon mapping for common chores (fallback to ✨)
const getIconForChore = (name = "") => {
  const lower = name.toLowerCase();
  if (lower.includes("kitchen") || lower.includes("counter")) return "🧽";
  if (lower.includes("dish")) return "🍽️";
  if (lower.includes("trash") || lower.includes("garbage")) return "🗑️";
  if (lower.includes("bathroom") || lower.includes("toilet")) return "🪠";
  if (lower.includes("vacuum") || lower.includes("floor")) return "🧹";
  if (lower.includes("dust")) return "✨";
  if (lower.includes("grocery") || lower.includes("shopping")) return "🛒";
  return "✨";
};

export default function GeneratedSchedulePage({
  onAccept = (chores) => {},
  onAdjust = () => {},
}) {
  const [chores, setChores] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChore, setNewChore] = useState({
    name: "",
    description: "",
    notes: "",
    difficulty_level: 1,
    duration: 30,
    chore_frequency: "Weekly",
    chore_priority: 2,
    icon: "✨",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingTickets, setGeneratingTickets] = useState(false);
  // Remove totalChoresCreated state - we'll use chores.length instead

  // Load AI‑generated chores for the current user when page mounts
  useEffect(() => {
    const loadChores = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await choresAPI.generateHouseChores();

        if (result.status !== "success") {
          setError(result.message || "Failed to generate chores");
          setChores([]);
          return;
        }

        // New API format: result.chores is a flat array, result.total_chores_created is the count
        const allChores = result.chores || [];

        if (!Array.isArray(allChores) || allChores.length === 0) {
          setError(
            "No chores were generated yet. Try again later or adjust your preferences."
          );
          setChores([]);
          return;
        }

        // Map the chores to the format expected by the UI
        const mapped = allChores.map((chore, index) => ({
          id: index + 1,
          name: chore.name || "",
          description: chore.description || "",
          difficulty_level: chore.difficulty_level || 1,
          duration: chore.duration || 30,
          chore_frequency: chore.chore_frequency || "Weekly",
          chore_priority: chore.chore_priority || 2,
          icon: chore.icon || getIconForChore(chore.name), // Use backend icon if present
          notes: chore.notes || "", // Use 'notes' field instead of 'reason'
        }));

        setChores(mapped);
      } catch (e) {
        console.error("Failed to generate chores:", e);
        setError(
          e?.message ||
            "Failed to generate household schedule. Please try again."
        );
        setChores([]);
      } finally {
        setLoading(false);
      }
    };

    loadChores();
  }, []);

  const totalTime = chores.reduce((sum, chore) => sum + chore.duration, 0);

  const difficultyStars = (level) => "⭐".repeat(level);

  const priorityLabel = (priority) => {
    if (priority === 1) return "Low";
    if (priority === 2) return "Medium";
    return "High";
  };

  const priorityColor = (priority) => {
    if (priority === 1) return "#10b981";
    if (priority === 2) return "#f59e0b";
    return "#ef4444";
  };

  const handleEdit = (id) => {
    setEditingId(id);
  };

  const handleSave = () => {
    setEditingId(null);
  };

  const handleDelete = (id) => {
    setChores(chores.filter((chore) => chore.id !== id));
  };

  const handleChange = (id, field, value) => {
    setChores(
      chores.map((chore) =>
        chore.id === id ? { ...chore, [field]: value } : chore
      )
    );
  };

  const handleAddChore = () => {
    if (!newChore.name.trim()) return;

    const id = Math.max(0, ...chores.map((c) => c.id)) + 1;
    setChores([...chores, { ...newChore, id }]);
    setNewChore({
      name: "",
      description: "",
      difficulty_level: 1,
      duration: 30,
      chore_frequency: "Weekly",
      chore_priority: 2,
      icon: "✨",
    });
    setShowAddForm(false);
  };

  const handleAccept = async () => {
    setSaving(true);
    setError("");
    
    try {
      // Step 1: Save chores to database
      const choresToSave = chores.map((chore) => ({
        name: chore.name,
        description: chore.description,
        difficulty_level: chore.difficulty_level,
        duration: chore.duration,
        chore_frequency: chore.chore_frequency,
        chore_priority: chore.chore_priority,
        notes: chore.notes || null,
        icon: chore.icon || null,
      }));

      const saveResult = await choresAPI.saveGeneratedChores(choresToSave);
      
      if (saveResult.status !== "chores added to db") {
        setError("Failed to save chores. Please try again.");
        setSaving(false);
        return;
      }

      // Step 2: Generate monthly tickets - show full page loading
      setSaving(false);
      setGeneratingTickets(true);

      const ticketsResult = await choresAPI.generateMonthlyTickets();
      
      if (ticketsResult.status === "success") {
        // Call the onAccept callback to navigate or show success
        onAccept(chores);
      } else {
        setError(ticketsResult.message || "Failed to generate tickets. Please try again.");
        setGeneratingTickets(false);
      }
    } catch (e) {
      console.error("Failed to save chores or generate tickets:", e);
      setError(e?.message || "Failed to complete the process. Please try again.");
      setSaving(false);
      setGeneratingTickets(false);
    }
  };

  // Show loading screen when generating tickets
  if (generatingTickets) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(to bottom right, #faf5ff, #f3e8ff)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          gap: "24px",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "linear-gradient(45deg, #4c1d95, #7c3aed, #e9d5ff, #f3e8ff, #7c3aed, #4c1d95)",
            backgroundSize: "300% 300%",
            animation: "rotate 4s linear infinite",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "3px 3px 10px 1px rgba(76, 29, 149, 0.5)",
          }}
        >
          <Sparkles 
            style={{ 
              width: "32px", 
              height: "32px", 
              color: "white",
              animation: "pulse 1.5s ease-in-out infinite"
            }} 
          />
        </div>
        <p style={{ color: "#6b7280", fontSize: "16px", textAlign: "center" }}>
          Generating chore chart for the entire month based on user preferences...
        </p>
        <style>{`
          @keyframes rotate {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(0.95);
            }
          }
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(to bottom right, #faf5ff, #f3e8ff)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          gap: "24px",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "linear-gradient(45deg, #4c1d95, #7c3aed, #e9d5ff, #f3e8ff, #7c3aed, #4c1d95)",
            backgroundSize: "300% 300%",
            animation: "rotate 4s linear infinite",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "3px 3px 10px 1px rgba(76, 29, 149, 0.5)",
          }}
        >
          <Sparkles 
            style={{ 
              width: "32px", 
              height: "32px", 
              color: "white",
              animation: "pulse 1.5s ease-in-out infinite"
            }} 
          />
        </div>
        <p style={{ color: "#6b7280", fontSize: "16px", textAlign: "center" }}>
          Generating your household schedule based on everyone's
          preferences...
        </p>
        <style>{`
          @keyframes rotate {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(0.95);
            }
          }
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #faf5ff, #f3e8ff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "896px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "linear-gradient(to bottom right, #22c55e, #16a34a)",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 10px 15px rgba(0, 0, 0, 0.1)",
            }}
          >
            <Sparkles style={{ width: "32px", height: "32px", color: "white" }} />
          </div>
          <h1
            style={{
              color: "#111827",
              marginBottom: "8px",
              fontSize: "28px",
              fontWeight: "600",
            }}
          >
            Your Optimized Chore Plan!
          </h1>
          <p style={{ color: "#6b7280", fontSize: "16px" }}>
            Generated from your household&apos;s preferences and availability
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px",
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <Card style={{ borderColor: "#e9d5ff" }}>
            <CardContent style={{ padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    backgroundColor: "#fed7aa",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Clock style={{ width: "24px", height: "24px", color: "#ea580c" }} />
                </div>
                <div>
                  <p
                    style={{
                      color: "#6b7280",
                      fontSize: "12px",
                      marginBottom: "4px",
                    }}
                  >
                    Total Weekly Commitment
                  </p>
                  <p
                    style={{
                      color: "#111827",
                      fontSize: "18px",
                      fontWeight: "600",
                    }}
                  >
                    ~{totalTime} min
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card style={{ borderColor: "#e9d5ff" }}>
            <CardContent style={{ padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    backgroundColor: "#cffafe",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Calendar
                    style={{ width: "24px", height: "24px", color: "#0891b2" }}
                  />
                </div>
                <div>
                  <p
                    style={{
                      color: "#6b7280",
                      fontSize: "12px",
                      marginBottom: "2px",
                    }}
                  >
                    Total Chores Created
                  </p>
                  <p
                    style={{
                      color: "#111827",
                      fontSize: "18px",
                      fontWeight: "600",
                    }}
                  >
                    {chores.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Schedule */}
        <Card
          style={{
            borderColor: "#e9d5ff",
            boxShadow: "0 20px 25px rgba(0, 0, 0, 0.1)",
            marginBottom: "24px",
          }}
        >
          <CardContent style={{ padding: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3
                style={{
                  color: "#111827",
                  fontSize: "20px",
                  fontWeight: "600",
                  margin: 0,
                }}
              >
                Your Weekly Schedule
              </h3>
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                style={{
                  backgroundColor: "#7c3aed",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                }}
              >
                <Plus style={{ width: "16px", height: "16px" }} />
                Add Chore
              </Button>
            </div>

            {/* Add Chore Form */}
            {showAddForm && (
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <h4
                    style={{
                      color: "#111827",
                      fontSize: "16px",
                      fontWeight: "600",
                      margin: 0,
                    }}
                  >
                    Add New Chore
                  </h4>
                  <button
                    onClick={() => setShowAddForm(false)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    <X style={{ width: "20px", height: "20px", color: "#6b7280" }} />
                  </button>
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: "12px",
                          color: "#374151",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Chore Name *
                      </label>
                      <Input
                        value={newChore.name}
                        onChange={(e) =>
                          setNewChore({ ...newChore, name: e.target.value })
                        }
                        placeholder="e.g., Clean Kitchen"
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "12px",
                          color: "#374151",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Icon
                      </label>
                      <Input
                        value={newChore.icon}
                        onChange={(e) =>
                          setNewChore({ ...newChore, icon: e.target.value })
                        }
                        placeholder="🧽"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: "12px",
                        color: "#374151",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Description
                    </label>
                    <Textarea
                      value={newChore.description}
                      onChange={(e) =>
                        setNewChore({ ...newChore, description: e.target.value })
                      }
                      placeholder="Brief description of the chore"
                      style={{ minHeight: "60px", color: "#111827" }}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: "12px",
                          color: "#374151",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Difficulty (1-5)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        value={newChore.difficulty_level}
                        onChange={(e) =>
                          setNewChore({
                            ...newChore,
                            difficulty_level: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "12px",
                          color: "#374151",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Duration (min)
                      </label>
                      <Input
                        type="number"
                        min="5"
                        value={newChore.duration}
                        onChange={(e) =>
                          setNewChore({
                            ...newChore,
                            duration: parseInt(e.target.value) || 5,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "12px",
                          color: "#374151",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Priority (1-3)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="3"
                        value={newChore.chore_priority}
                        onChange={(e) =>
                          setNewChore({
                            ...newChore,
                            chore_priority: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: "12px",
                        color: "#374151",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Frequency
                    </label>
                    <select
                      value={newChore.chore_frequency}
                      onChange={(e) =>
                        setNewChore({
                          ...newChore,
                          chore_frequency: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "1px solid #d1d5db",
                        fontSize: "14px",
                        backgroundColor: "white",
                      }}
                    >
                      <option value="Daily">Daily</option>
                      <option value="Twice a week">Twice a week</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Once in two weeks">Once in two weeks</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>

                  <Button
                    onClick={handleAddChore}
                    disabled={!newChore.name.trim()}
                    style={{
                      backgroundColor: "#16a34a",
                      color: "white",
                      width: "100%",
                      opacity: !newChore.name.trim() ? 0.5 : 1,
                    }}
                  >
                    Add Chore
                  </Button>
                </div>
              </div>
            )}

            {/* Chores List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {chores.map((chore) => (
                <div
                  key={chore.id}
                  style={{
                    padding: "16px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  {editingId === chore.id ? (
                    // Edit Mode
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              color: "#374151",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            Chore Name
                          </label>
                          <Input
                            value={chore.name}
                            onChange={(e) =>
                              handleChange(chore.id, "name", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              color: "#374151",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            Icon
                          </label>
                          <Input
                            value={chore.icon}
                            onChange={(e) =>
                              handleChange(chore.id, "icon", e.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            color: "#374151",
                            display: "block",
                            marginBottom: "4px",
                          }}
                        >
                          Description
                        </label>
                        <Textarea
                          value={chore.description}
                          onChange={(e) =>
                            handleChange(chore.id, "description", e.target.value)
                          }
                          style={{ minHeight: "60px", color: "#111827" }}
                        />
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              color: "#374151",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            Difficulty (1-5)
                          </label>
                          <Input
                            type="number"
                            min="1"
                            max="5"
                            value={chore.difficulty_level}
                            onChange={(e) =>
                              handleChange(
                                chore.id,
                                "difficulty_level",
                                parseInt(e.target.value) || 1
                              )
                            }
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              color: "#374151",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            Duration (min)
                          </label>
                          <Input
                            type="number"
                            min="5"
                            value={chore.duration}
                            onChange={(e) =>
                              handleChange(
                                chore.id,
                                "duration",
                                parseInt(e.target.value) || 5
                              )
                            }
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              color: "#374151",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            Priority (1-3)
                          </label>
                          <Input
                            type="number"
                            min="1"
                            max="3"
                            value={chore.chore_priority}
                            onChange={(e) =>
                              handleChange(
                                chore.id,
                                "chore_priority",
                                parseInt(e.target.value) || 1
                              )
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            color: "#374151",
                            display: "block",
                            marginBottom: "4px",
                          }}
                        >
                          Frequency
                        </label>
                        <select
                          value={chore.chore_frequency}
                          onChange={(e) =>
                            handleChange(
                              chore.id,
                              "chore_frequency",
                              e.target.value
                            )
                          }
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid #d1d5db",
                            fontSize: "14px",
                            backgroundColor: "white",
                          }}
                        >
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Twice a week">Twice a week</option>
                          <option value="Once in two weeks">Once in two weeks</option>
                        </select>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "flex-end",
                        }}
                      >
                        <Button
                          onClick={() => handleSave(chore.id)}
                          style={{
                            backgroundColor: "#16a34a",
                            color: "white",
                            padding: "8px 16px",
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          onClick={() => setEditingId(null)}
                          variant="outline"
                          style={{
                            padding: "8px 16px",
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "16px",
                        }}
                      >
                        <div style={{ fontSize: "32px" }}>{chore.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              marginBottom: "8px",
                            }}
                          >
                            <div>
                              <p
                                style={{
                                  color: "#111827",
                                  fontSize: "16px",
                                  fontWeight: "600",
                                  marginBottom: "4px",
                                }}
                              >
                                {chore.name}
                              </p>
                              <p
                                style={{
                                  color: "#6b7280",
                                  fontSize: "13px",
                                  marginBottom: "8px",
                                }}
                              >
                                {chore.description}
                              </p>
                              {chore.notes && (
                                <p
                                  style={{
                                    color: "#6b7280",
                                    fontSize: "12px",
                                    fontStyle: "italic",
                                    marginTop: "4px",
                                  }}
                                >
                                  {chore.notes}
                                </p>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => handleEdit(chore.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "4px",
                                }}
                              >
                                <Edit2
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    color: "#7c3aed",
                                  }}
                                />
                              </button>
                              <button
                                onClick={() => handleDelete(chore.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "4px",
                                }}
                              >
                                <Trash2
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    color: "#ef4444",
                                  }}
                                />
                              </button>
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: "16px",
                              flexWrap: "wrap",
                              fontSize: "12px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span style={{ color: "#6b7280" }}>Difficulty:</span>
                              <span style={{ fontSize: "14px" }}>
                                {difficultyStars(chore.difficulty_level)}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Clock
                                style={{
                                  width: "14px",
                                  height: "14px",
                                  color: "#6b7280",
                                }}
                              />
                              <span style={{ color: "#111827" }}>
                                ~{chore.duration}min
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Calendar
                                style={{
                                  width: "14px",
                                  height: "14px",
                                  color: "#6b7280",
                                }}
                              />
                              <span style={{ color: "#111827" }}>
                                {chore.chore_frequency}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                backgroundColor: `${priorityColor(
                                  chore.chore_priority
                                )}20`,
                                color: priorityColor(chore.chore_priority),
                                fontWeight: "600",
                              }}
                            >
                              {priorityLabel(chore.chore_priority)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          <Button
            variant="outline"
            onClick={onAdjust}
            style={{
              borderColor: "#d8b4fe",
              color: "#7c3aed",
              padding: "24px",
              fontSize: "16px",
            }}
          >
            I'd like to regenerate
          </Button>
          <Button
            onClick={handleAccept}
            disabled={saving || generatingTickets || chores.length === 0}
            style={{
              backgroundColor: (saving || generatingTickets) ? "#9ca3af" : "#6d28d9",
              color: "white",
              padding: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "16px",
              opacity: (saving || generatingTickets || chores.length === 0) ? 0.6 : 1,
              cursor: (saving || generatingTickets || chores.length === 0) ? "not-allowed" : "pointer",
            }}
          >
            {saving ? (
              <>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid white",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Saving...
              </>
            ) : generatingTickets ? (
              <>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid white",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Generating...
              </>
            ) : (
              <>
                <CheckCircle style={{ width: "20px", height: "20px" }} />
                This looks good to me
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}