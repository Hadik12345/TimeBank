import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// --- UI & Icon Imports ---
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Textarea } from './components/ui/textarea';
import { toast, Toaster } from 'sonner';
import {
    Clock, MapPin, User, CreditCard, Plus, Eye, Camera, CheckCircle,
    LayoutDashboard, Search, ListChecks, UserCog, LogOut, Briefcase,
    Handshake, BarChart2, ArrowRight, ArrowLeft, UploadCloud
} from 'lucide-react';
import './App.css';

// --- Supabase and API Configuration ---
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://timebank-note.onrender.com';
const API = `${BACKEND_URL}/api`;

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Axios interceptor to add the auth token to every request
axios.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// --- Main App Component ---
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Immediately check for an active session to resolve the initial loading state.
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: userProfile } = await axios.get(`${API}/auth/me`);
          setUser(userProfile);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Initial user check failed:", error);
        setUser(null);
        // Even if it fails, we need to stop loading to show the auth page.
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // 2. Set up a listener for subsequent auth state changes (e.g., login, logout).
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Refetch user profile on sign-in
          axios.get(`${API}/auth/me`)
            .then(response => setUser(response.data))
            .catch(error => {
              console.error("Failed to refetch user on SIGNED_IN", error);
              setUser(null);
            });
          toast.success("Logged in successfully!");
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    // 3. Cleanup the listener on component unmount.
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="App min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
          <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <AuthPage />} />
          <Route path="/dashboard/*" element={user ? <DashboardLayout user={user} setUser={setUser} /> : <Navigate to="/auth" />} />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </BrowserRouter>
  );
}

// --- Authentication & Landing Components ---
function AuthPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleAuthAction = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
                if (error) throw error;
                toast.success("Account created! Please log in.");
                setIsSignUp(false);
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
        } catch (error) {
            toast.error(error.message || "An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl text-gray-800">{isSignUp ? 'Create an Account' : 'Welcome Back'}</CardTitle>
                    <CardDescription>{isSignUp ? 'Enter your details to get started.' : 'Log in to continue to TimeBank.'}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAuthAction} className="space-y-4">
                        {isSignUp && (<div><Label htmlFor="name">Full Name</Label><Input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="John Doe" /></div>)}
                        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" /></div>
                        <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" /></div>
                        <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">{loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}</Button>
                    </form>
                    <div className="mt-4 text-center text-sm"><p>{isSignUp ? 'Already have an account?' : "Don't have an account?"}<Button variant="link" onClick={() => setIsSignUp(!isSignUp)} className="text-emerald-600">{isSignUp ? 'Log In' : 'Sign Up'}</Button></p></div>
                </CardContent>
            </Card>
        </div>
    );
}

function LandingPage() {
  return (
    <div className="min-h-screen">
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex justify-between items-center py-4"><div className="flex items-center space-x-2"><Clock className="h-8 w-8 text-emerald-600" /><span className="text-2xl font-bold text-gray-800">TimeBank</span></div><Link to="/auth"><Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-full shadow-md">Login or Sign Up</Button></Link></div></div>
      </nav>
      <section className="py-20 px-4 text-center"><h1 className="text-5xl md:text-7xl font-bold text-gray-800 mb-6">Trade Time, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-cyan-600">Not Money</span></h1><p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">Join the hyperlocal micro-time exchange platform where 15-60 minute tasks earn you time credits to request help from your community.</p><Link to="/auth"><Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 text-lg rounded-full shadow-xl"><Clock className="mr-2 h-5 w-5" /> Start Trading Time</Button></Link><div className="mt-4 text-sm text-emerald-600 font-medium">🎉 Start with 60 minutes of free credits!</div></section>
    </div>
  );
}

// --- Dashboard Layout and Sidebar ---

function DashboardLayout({ user, setUser }) {
    const [tasks, setTasks] = useState([]);
    const [myTasks, setMyTasks] = useState([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    const loadTasks = useCallback(async (filters = {}) => {
        setLoadingTasks(true);
        try {
            const params = { status: 'open', ...filters };
            if (filters.taskType === 'all') delete params.taskType;
            const { data } = await axios.get(`${API}/tasks`, { params });
            setTasks(data);
        } catch (error) { toast.error('Failed to load explore tasks.'); }
        finally { setLoadingTasks(false); }
    }, []);

    const loadMyTasks = useCallback(async () => {
        setLoadingTasks(true);
        try {
            const { data } = await axios.get(`${API}/tasks/my`);
            setMyTasks(data);
        } catch (error) { toast.error('Failed to load your tasks.'); }
        finally { setLoadingTasks(false); }
    }, []);

    const refreshAllTasks = useCallback(() => {
        loadTasks();
        loadMyTasks();
    }, [loadTasks, loadMyTasks]);

    useEffect(() => {
        if(user) {
            refreshAllTasks();
        }
    }, [user, refreshAllTasks]);

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar user={user} onLogout={handleLogout} />
            <main className="flex-1 p-8 overflow-y-auto">
                <Routes>
                    <Route index element={<DashboardHome user={user} myTasks={myTasks} />} />
                    <Route path="explore" element={<BrowseTasks tasks={tasks} loadTasks={loadTasks} loading={loadingTasks} />} />
                    <Route path="my-tasks" element={<MyTasks user={user} myTasks={myTasks} loading={loadingTasks} />} />
                    <Route path="task/:taskId" element={<TaskDetailPage user={user} onUpdate={refreshAllTasks}/>} />
                    <Route path="profile" element={<ProfileSettings user={user} setUser={setUser} />} />
                    <Route path="create" element={<CreateTask onTaskCreated={refreshAllTasks} />} />
                </Routes>
            </main>
        </div>
    );
}

function Sidebar({ user, onLogout }) {
    const location = useLocation();
    const navItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/dashboard/explore', icon: Search, label: 'Explore Tasks' },
        { path: '/dashboard/my-tasks', icon: ListChecks, label: 'My Tasks' },
        { path: '/dashboard/profile', icon: UserCog, label: 'Profile' },
    ];

    return (
        <aside className="w-64 bg-white flex flex-col p-4 border-r border-gray-200">
            <div className="flex items-center space-x-2 mb-8"><Clock className="h-8 w-8 text-emerald-600" /><span className="text-2xl font-bold text-gray-800">TimeBank</span></div>
            <div className="bg-emerald-500 text-white p-4 rounded-lg mb-6"><p className="text-sm opacity-80">Your Time Credits</p><p className="text-2xl font-bold">{user.time_credits} min</p></div>
            <nav className="flex-1 flex flex-col space-y-2">
                {navItems.map(item => (<Link key={item.path} to={item.path} className={`flex items-center p-2 rounded-lg transition-colors ${location.pathname.startsWith(item.path) && item.path !== '/dashboard' || location.pathname === '/dashboard' && item.path === '/dashboard' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'}`}><item.icon className="h-5 w-5 mr-3" /> <span className="font-medium">{item.label}</span></Link>))}
            </nav>
            <Link to="/dashboard/create" className="w-full"><Button className="w-full bg-emerald-600 hover:bg-emerald-700 mb-4"><Plus className="h-5 w-5 mr-2"/> Create Task</Button></Link>
            <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center space-x-3"><img src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=059669&color=fff`} alt={user.name} className="w-10 h-10 rounded-full" /><div><p className="font-semibold text-sm text-gray-800">{user.name}</p><p className="text-xs text-gray-500 truncate">{user.email}</p></div></div>
                <Button variant="ghost" onClick={onLogout} className="w-full justify-start text-gray-600 hover:text-red-600 mt-2"><LogOut className="h-4 w-4 mr-2" /> Logout</Button>
            </div>
        </aside>
    );
}

// --- Page Components ---

function DashboardHome({ user, myTasks }) {
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800">Welcome back, {user.name.split(' ')[0]}! 👋</h1>
            <p className="text-gray-600 mt-1">Ready to exchange time and skills.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
                <StatCard icon={Clock} title="Time Credits" value={`${user.time_credits} min`} color="blue" />
                <StatCard icon={Briefcase} title="Tasks Completed" value={myTasks.filter(t => t.status === 'validated').length} color="green" />
                <StatCard icon={Handshake} title="Tasks Received" value={myTasks.filter(t => t.status === 'validated' && t.created_by === user.id).length} color="purple" />
                <StatCard icon={BarChart2} title="Impact Score" value="0" color="orange" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                <div className="lg:col-span-2">
                    <Card className="shadow-sm"><CardHeader><CardTitle>Active Tasks</CardTitle></CardHeader><CardContent>{myTasks.filter(t => t.status === 'assigned').length > 0 ? (<div className="space-y-4">{myTasks.filter(t => t.status === 'assigned').map(task => (<MyTaskCard key={task.id} task={task} />))}</div>) : (<div className="text-center py-10"><p className="text-gray-500 mb-4">No active tasks yet.</p><Link to="/dashboard/explore"><Button>Explore Tasks</Button></Link></div>)}</CardContent></Card>
                </div>
                <div>
                     <Card className="shadow-sm"><CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader><CardContent className="space-y-3"><QuickActionLink to="/dashboard/create" icon={Plus} title="Offer Your Time" description="Help someone and earn credits" /><QuickActionLink to="/dashboard/create" icon={User} title="Request Help" description="Find someone to assist you" /><QuickActionLink to="/dashboard/profile" icon={UserCog} title="Update Skills" description="Get better task matches" /></CardContent></Card>
                </div>
            </div>
        </div>
    );
}

function BrowseTasks({ tasks, loadTasks, loading }) {
  const [filters, setFilters] = useState({ searchTerm: '', taskType: 'all' });

  useEffect(() => {
    const handler = setTimeout(() => {
        loadTasks({ title: filters.searchTerm, task_type: filters.taskType });
    }, 500);
    return () => { clearTimeout(handler); };
  }, [filters, loadTasks]);

  return (
    <div>
        <h1 className="text-3xl font-bold text-gray-800">Explore Tasks</h1>
        <p className="text-gray-600 mt-1 mb-6">Find opportunities to help or get help from your community.</p>
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex items-center gap-4">
            <div className="relative flex-grow"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><Input id="search-tasks" placeholder="Search tasks..." value={filters.searchTerm} onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))} className="pl-10"/></div>
            <Select value={filters.taskType} onValueChange={(v) => setFilters(prev => ({ ...prev, taskType: v }))}><SelectTrigger id="browse-task-type" className="w-[180px]"><SelectValue placeholder="All Types" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="offer">Offering</SelectItem><SelectItem value="request">Requesting</SelectItem></SelectContent></Select>
        </div>
        {loading ? <p>Loading tasks...</p> : (<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{tasks.map((task) => <TaskCard key={task.id} task={task} onAssign={() => loadTasks(filters)} />)}</div>)}
        {!loading && tasks.length === 0 && <div className="text-center py-12"><Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-500">No open tasks found matching your criteria.</p></div>}
    </div>
  );
}

function MyTasks({ user, myTasks, loading }) {
  const [activeTab, setActiveTab] = useState('doing');

  const tasksCreated = myTasks.filter(task => task.created_by === user.id);
  const tasksDoing = myTasks.filter(task => task.assigned_to === user.id);
  const tasksToShow = activeTab === 'created' ? tasksCreated : tasksDoing;

  return (
      <div>
          <h1 className="text-3xl font-bold text-gray-800">My Tasks</h1>
          <p className="text-gray-600 mt-1 mb-6">Track your task offers and assignments.</p>
          <div className="flex space-x-4 border-b mb-6"><button onClick={() => setActiveTab('created')} className={`py-2 px-1 font-medium ${activeTab === 'created' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-gray-500'}`}>Tasks I Created ({tasksCreated.length})</button><button onClick={() => setActiveTab('doing')} className={`py-2 px-1 font-medium ${activeTab === 'doing' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-gray-500'}`}>Tasks I'm Doing ({tasksDoing.length})</button></div>
          {loading ? <p>Loading your tasks...</p> : (<div className="space-y-4">{tasksToShow.map((task) => <MyTaskCard key={task.id} task={task} />)}</div>)}
          {!loading && tasksToShow.length === 0 && (<div className="text-center py-16 bg-white rounded-lg border"><ListChecks className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-500">{activeTab === 'created' ? "You haven't created any tasks yet." : "You haven't accepted any tasks."}</p></div>)}
      </div>
  );
}

function CreateTask({ onTaskCreated }) {
    const [formData, setFormData] = useState({ title: '', description: '', duration: 30, credits_offered: 30, task_type: 'request', skills_required: '', location: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`${API}/tasks`, { ...formData, skills_required: formData.skills_required.split(',').map(s => s.trim()).filter(Boolean) });
            toast.success('Task created successfully!');
            onTaskCreated();
            navigate('/dashboard/my-tasks');
        } catch (error) { toast.error(error.response?.data?.detail || 'Failed to create task'); }
        finally { setLoading(false); }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Create a New Task</h1>
            <Card className="max-w-2xl mx-auto shadow-sm">
                <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div><Label htmlFor="title-create">Task Title</Label><Input id="title-create" value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Walk my dog" required /></div>
                        <div><Label htmlFor="desc-create">Description</Label><Textarea id="desc-create" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="A friendly golden retriever needs a 30-minute walk." required /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label htmlFor="create-task-type">Task Type</Label><Select value={formData.task_type} onValueChange={(v) => setFormData(p => ({...p, task_type: v}))}><SelectTrigger id="create-task-type"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="request">I Need Help</SelectItem><SelectItem value="offer">I'm Offering Help</SelectItem></SelectContent></Select></div>
                            <div><Label htmlFor="create-duration">Duration (mins)</Label><Input id="create-duration" type="number" value={formData.duration} onChange={e => setFormData(p => ({...p, duration: parseInt(e.target.value) || 30}))} min="15" max="60" required/></div>
                        </div>
                        <div><Label htmlFor="create-credits">Credits</Label><Input id="create-credits" type="number" value={formData.credits_offered} onChange={e => setFormData(p => ({...p, credits_offered: parseInt(e.target.value) || 30}))} min="1" required/></div>
                        <div><Label htmlFor="create-location">Location</Label><Input id="create-location" value={formData.location} onChange={e => setFormData(p => ({...p, location: e.target.value}))} placeholder="e.g., Central Park" required /></div>
                        <div><Label htmlFor="create-skills">Skills (comma-separated)</Label><Input id="create-skills" value={formData.skills_required} onChange={e => setFormData(p => ({...p, skills_required: e.target.value}))} placeholder="e.g., Dog walking, Punctual" /></div>
                        <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">{loading ? 'Creating...' : 'Create Task'}</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

function ProfileSettings({ user, setUser }) {
    const [formData, setFormData] = useState({ name: user.name || '', skills: user.skills?.join(', ') || '', location: user.location || '', availability: user.availability || '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => { setFormData({ name: user.name || '', skills: user.skills?.join(', ') || '', location: user.location || '', availability: user.availability || '' }); }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await axios.put(`${API}/users/profile`, { ...formData, skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean) });
            setUser(prevUser => ({ ...prevUser, ...data }));
            toast.success('Profile updated!');
        } catch (error) { toast.error('Failed to update profile.'); }
        finally { setLoading(false); }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Profile</h1>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1"><Card className="shadow-sm"><CardContent className="p-6 text-center"><img src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=059669&color=fff&size=128`} alt={user.name} className="w-32 h-32 rounded-full mx-auto mb-4" /><h2 className="text-xl font-bold text-gray-800">{user.name}</h2><p className="text-gray-500">{user.email}</p></CardContent></Card></div>
                    <div className="lg:col-span-2 space-y-8">
                        <Card className="shadow-sm"><CardHeader><CardTitle>Personal Information</CardTitle><CardDescription>Update your personal details here.</CardDescription></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="profile-name">Full Name</Label><Input id="profile-name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" /></div><div><Label htmlFor="profile-email">Email Address</Label><Input id="profile-email" value={user.email} disabled className="bg-gray-100 cursor-not-allowed" /></div><div><Label htmlFor="profile-location">My Location</Label><Input id="profile-location" value={formData.location} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} placeholder="e.g., New York, NY" /></div></CardContent></Card>
                        <Card className="shadow-sm"><CardHeader><CardTitle>Skills & Availability</CardTitle><CardDescription>Let others know what you can do and when you're free.</CardDescription></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="profile-skills">My Skills (comma-separated)</Label><Textarea id="profile-skills" value={formData.skills} onChange={e => setFormData(p => ({ ...p, skills: e.target.value }))} placeholder="e.g., Gardening, Tutoring, Dog walking" /></div><div><Label htmlFor="profile-availability">My Availability</Label><Textarea id="profile-availability" value={formData.availability} onChange={e => setFormData(p => ({ ...p, availability: e.target.value }))} placeholder="e.g., Weekdays after 6 PM, Weekend mornings" /></div></CardContent></Card>
                        <div className="flex justify-end"><Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">{loading ? 'Saving...' : 'Save Changes'}</Button></div>
                    </div>
                </div>
            </form>
        </div>
    );
}

function TaskDetailPage({user, onUpdate}) {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchTask = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch all tasks and find the one with the matching ID
            // This is not the most efficient way, but works for now.
            // A dedicated /api/tasks/{taskId} endpoint would be better.
            const { data } = await axios.get(`${API}/tasks/my`);
            const foundTask = data.find(t => t.id === taskId);
            if (foundTask) { setTask(foundTask); }
            else { toast.error("Task not found or you don't have access."); navigate('/dashboard/my-tasks'); }
        } catch (error) { toast.error("Failed to load task details."); }
        finally { setLoading(false); }
    }, [taskId, navigate]);

    useEffect(() => { fetchTask(); }, [fetchTask]);

    const handlePhotoUpload = async (file, type) => {
        if (!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            try {
                const { data } = await axios.put(`${API}/tasks/${taskId}`, { [`${type}_photo`]: reader.result });
                setTask(data);
                toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} photo uploaded!`);
            } catch (error) { toast.error(`Failed to upload ${type} photo.`); }
        };
    };

    const handleValidation = async () => {
        if (!task.before_photo || !task.after_photo) { toast.warning("Please upload both before and after photos."); return; }
        try {
            await axios.post(`${API}/tasks/${taskId}/validate`);
            toast.success("Task submitted for validation!");
            onUpdate(); // Refresh all tasks in the main layout
            fetchTask(); // Re-fetch this task to get updated status
        }
        catch (error) { toast.error(error.response?.data?.detail || "Validation failed."); }
    }

    if (loading) return <div>Loading task details...</div>;
    if (!task) return <div>Task not found.</div>;

    const isTaskAssignee = task.assigned_to === user.id;

    return (
        <div>
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            <Card className="mb-6"><CardContent className="p-6"><div className="flex justify-between items-start"><div><div className="flex items-center gap-2 mb-2"><Badge variant="outline" className="capitalize">{task.task_type}ing</Badge><Badge variant="secondary" className="bg-yellow-100 text-yellow-800 capitalize">{task.status}</Badge></div><h2 className="text-2xl font-bold text-gray-800">{task.title}</h2></div><div className="text-right"><p className="text-gray-500">Credits</p><p className="text-2xl font-bold text-emerald-600">{task.credits_offered} min</p></div></div><p className="text-gray-600 mt-4">{task.description}</p><div className="border-t mt-4 pt-4 flex gap-8 text-sm"><div className="flex items-center text-gray-600"><Clock className="h-4 w-4 mr-2"/>Duration: <span className="font-semibold ml-1">{task.duration} minutes</span></div><div className="flex items-center text-gray-600"><MapPin className="h-4 w-4 mr-2"/>Location: <span className="font-semibold ml-1">{task.location}</span></div></div></CardContent></Card>
            {isTaskAssignee && task.status === 'assigned' && (
                <Card><CardHeader><CardTitle>Upload Verification Photos</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6"><PhotoUploader label="Before Photo" photo={task.before_photo} onUpload={(file) => handlePhotoUpload(file, 'before')} /><PhotoUploader label="After Photo" photo={task.after_photo} onUpload={(file) => handlePhotoUpload(file, 'after')} /></CardContent><CardContent><Button onClick={handleValidation} disabled={!task.before_photo || !task.after_photo} className="w-full bg-emerald-600 hover:bg-emerald-700">Complete Task</Button></CardContent></Card>
            )}
        </div>
    );
}


// --- Reusable Components ---

function StatCard({ icon: Icon, title, value, color }) {
    const colors = { blue: "bg-blue-100 text-blue-600", green: "bg-green-100 text-green-600", purple: "bg-purple-100 text-purple-600", orange: "bg-orange-100 text-orange-600" };
    return (<Card className="shadow-sm"><CardContent className="p-4 flex items-center"><div className={`p-3 rounded-lg ${colors[color]}`}><Icon className="h-6 w-6" /></div><div className="ml-4"><p className="text-sm text-gray-500">{title}</p><p className="text-xl font-bold text-gray-800">{value}</p></div></CardContent></Card>);
}

function QuickActionLink({ to, icon: Icon, title, description }) {
    return (<Link to={to} className="block p-4 rounded-lg hover:bg-gray-100 border"><div className="flex items-center"><Icon className="h-6 w-6 text-emerald-600 mr-4"/><div><p className="font-semibold text-gray-800">{title}</p><p className="text-sm text-gray-500">{description}</p></div></div></Link>);
}

function MyTaskCard({ task }) {
    const statusBadge = () => {
        switch(task.status) {
            case 'assigned': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
            case 'open': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Open</Badge>;
            case 'validated': return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
            default: return <Badge variant="secondary">{task.status}</Badge>;
        }
    };
    return (
        <Link to={`/dashboard/task/${task.id}`}>
            <Card className="bg-white p-4 shadow-sm hover:shadow-md transition-shadow rounded-lg cursor-pointer">
                <div className="flex justify-between items-start mb-2">{statusBadge()}<Badge variant="outline" className={task.task_type === 'request' ? 'text-green-600 border-green-600' : 'text-blue-600 border-blue-600'}>{task.task_type}</Badge></div>
                <h3 className="font-bold text-lg text-gray-800 mb-2">{task.title}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{task.description}</p>
                <div className="flex items-center text-sm text-gray-500 mb-4"><Clock className="h-4 w-4 mr-2" /><span>{task.duration} minutes</span></div>
                <div className="flex items-center text-sm text-gray-500 mb-4"><MapPin className="h-4 w-4 mr-2" /><span>{task.location}</span></div>
                <div className="border-t pt-3 flex justify-between items-center"><span className="text-gray-600">{task.credits_offered} credits</span><ArrowRight className="h-5 w-5 text-gray-400" /></div>
            </Card>
        </Link>
    );
}

function TaskCard({ task, onAssign }) {
    const TypeBadge = ({ type }) => (<span className={`text-sm font-semibold ${type === 'request' ? 'text-blue-600' : 'text-orange-600'}`}>{type === 'request' ? 'Requesting' : 'Offering'}</span>);
    const handleAssign = async () => {
      try { await axios.post(`${API}/tasks/${task.id}/assign`); toast.success('Task assigned successfully!'); if(onAssign) onAssign(); }
      catch (error) { toast.error(error.response?.data?.detail || 'Failed to assign task'); }
    }
    return (
        <Card className="border-gray-200 hover:shadow-lg transition-shadow duration-300 flex flex-col bg-white overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between"><TypeBadge type={task.task_type} /><div className="flex items-center text-sm text-gray-500"><Clock className="h-4 w-4 mr-1.5" />{task.duration} min</div></CardHeader>
            <CardContent className="space-y-3 flex-grow"><h3 className="font-bold text-lg text-gray-800">{task.title}</h3><p className="text-gray-600 text-sm line-clamp-3">{task.description}</p><div className="flex items-center text-sm text-gray-500"><MapPin className="h-4 w-4 mr-1.5" />{task.location}</div>{task.skills_required?.length > 0 && (<div className="flex flex-wrap gap-2 pt-2">{task.skills_required.map((skill, index) => (<Badge key={index} variant="secondary" className="text-xs bg-gray-100 text-gray-700 font-medium">{skill}</Badge>))}</div>)}</CardContent>
            <div className="bg-gray-50 px-6 py-3 border-t flex items-center justify-between"><span className="text-sm text-gray-500">Credits</span><span className="font-bold text-emerald-600">{task.credits_offered} min</span></div>
            {(task.status === 'open') && <div className="p-4"><Button onClick={handleAssign} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">Accept Task</Button></div>}
        </Card>
    );
}

function PhotoUploader({ label, photo, onUpload }) {
    const [uploading, setUploading] = useState(false);
    const inputRef = React.useRef(null);
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) { setUploading(true); onUpload(file).finally(() => setUploading(false)); }
    };
    return (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-500 transition-colors" onClick={() => inputRef.current.click()}>
            <input type="file" accept="image/*" ref={inputRef} onChange={handleFileChange} className="hidden" />
            {photo ? (<img src={photo} alt={label} className="w-full h-48 object-cover rounded-md"/>) : (<div className="flex flex-col items-center justify-center h-48"><UploadCloud className="h-10 w-10 text-gray-400 mb-2"/><span className="font-semibold text-emerald-600">Choose File</span><p className="text-sm text-gray-500">{label}</p></div>)}
            {uploading && <p className="text-sm mt-2">Uploading...</p>}
        </div>
    );
}

export default App;
