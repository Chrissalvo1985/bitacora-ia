import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ICONS } from '../constants';
import { useAuth } from '../context/AuthContext';
import { updateUser, changePassword, createUserAsAdmin, getAllUsers } from '../services/authService';
import { neon } from '@neondatabase/serverless';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';

// Get database URL
function getDatabaseUrl(): string | undefined {
  if (typeof process !== 'undefined' && process.env?.VITE_NEON_DATABASE_URL) {
    return process.env.VITE_NEON_DATABASE_URL;
  }
  try {
    if (import.meta?.env?.VITE_NEON_DATABASE_URL) {
      return (import.meta.env as any).VITE_NEON_DATABASE_URL;
    }
  } catch (e) {
    // Ignore
  }
  return undefined;
}

const databaseUrl = getDatabaseUrl();
const sql = databaseUrl ? neon(databaseUrl) : null;

interface Session {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

// Helper function to safely format dates
const formatDate = (date: string | Date | null | undefined, formatStr: string): string => {
  if (!date) return 'N/A';
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return 'N/A';
    return format(dateObj, formatStr, { locale: es });
  } catch {
    return 'N/A';
  }
};

const UserProfileView: React.FC = () => {
  const { user, refreshAuth } = useAuth();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPasswordLoading, setIsChangingPasswordLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user || !sql) return;
    
    setIsLoadingSessions(true);
    try {
      const token = localStorage.getItem('bitacora_auth_token');
      const result = await sql`
        SELECT id, token, created_at, expires_at
        FROM sessions
        WHERE user_id = ${user.id} AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
      `;
      
      const sessionsList: Session[] = result.map((s: any) => ({
        id: s.id,
        token: s.token,
        createdAt: s.created_at ? (s.created_at instanceof Date ? s.created_at.toISOString() : String(s.created_at)) : '',
        expiresAt: s.expires_at ? (s.expires_at instanceof Date ? s.expires_at.toISOString() : String(s.expires_at)) : '',
        isCurrent: s.token === token,
      }));
      
      setSessions(sessionsList);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setProfileError(null);
    setProfileSuccess(null);
    setIsSavingProfile(true);

    try {
      await updateUser(user.id, { name, email });
      setProfileSuccess('Perfil actualizado correctamente');
      await refreshAuth();
      setTimeout(() => {
        setIsEditingProfile(false);
        setProfileSuccess(null);
      }, 2000);
    } catch (error: any) {
      setProfileError(error.message || 'Error al actualizar el perfil');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;

    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsChangingPasswordLoading(true);

    try {
      await changePassword(user.id, oldPassword, newPassword);
      setPasswordSuccess('Contraseña actualizada correctamente. Serás redirigido al login...');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      setPasswordError(error.message || 'Error al cambiar la contraseña');
    } finally {
      setIsChangingPasswordLoading(false);
    }
  };

  const handleRevokeSession = async (sessionToken: string) => {
    if (!sql) return;
    
    try {
      await sql`DELETE FROM sessions WHERE token = ${sessionToken}`;
      await loadSessions();
      
      // If it's the current session, reload
      const currentToken = localStorage.getItem('bitacora_auth_token');
      if (sessionToken === currentToken) {
        localStorage.removeItem('bitacora_auth_token');
        window.location.reload();
      }
    } catch (error) {
      console.error('Error revoking session:', error);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ICONS.Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Mi Perfil</h1>
          <p className="text-gray-500">Gestiona tu cuenta y preferencias</p>
        </div>
      </div>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          {!isEditingProfile && (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <ICONS.Edit size={18} />
              Editar
            </button>
          )}
        </div>

        <AnimatePresence>
          {isEditingProfile ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              {profileError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                  <ICONS.AlertOctagon size={18} />
                  <span>{profileError}</span>
                </div>
              )}
              
              {profileSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
                  <ICONS.CheckCircle size={18} />
                  <span>{profileSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="tu@email.com"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSavingProfile ? (
                    <>
                      <ICONS.Loader2 className="animate-spin" size={18} />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <ICONS.Check size={18} />
                      Guardar Cambios
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsEditingProfile(false);
                    setName(user.name);
                    setEmail(user.email);
                    setProfileError(null);
                    setProfileSuccess(null);
                  }}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <ICONS.Calendar size={16} />
                <span>Miembro desde {formatDate(user.createdAt, "d 'de' MMMM, yyyy")}</span>
              </div>
              {user.lastLogin && (
                <div className="flex items-center gap-2 text-gray-600">
                  <ICONS.Clock size={16} />
                  <span>Último acceso: {formatDate(user.lastLogin, "d 'de' MMMM, yyyy 'a las' HH:mm")}</span>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Password Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Seguridad</h2>
            <p className="text-sm text-gray-500">Cambia tu contraseña</p>
          </div>
          {!isChangingPassword && (
            <button
              onClick={() => setIsChangingPassword(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <ICONS.Lock size={18} />
              Cambiar Contraseña
            </button>
          )}
        </div>

        <AnimatePresence>
          {isChangingPassword && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              {passwordError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                  <ICONS.AlertOctagon size={18} />
                  <span>{passwordError}</span>
                </div>
              )}
              
              {passwordSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
                  <ICONS.CheckCircle size={18} />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="••••••••"
                  minLength={8}
                />
                <p className="mt-1 text-xs text-gray-500">Mínimo 8 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="••••••••"
                  minLength={8}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPasswordLoading}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isChangingPasswordLoading ? (
                    <>
                      <ICONS.Loader2 className="animate-spin" size={18} />
                      Cambiando...
                    </>
                  ) : (
                    <>
                      <ICONS.Check size={18} />
                      Cambiar Contraseña
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsChangingPassword(false);
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError(null);
                    setPasswordSuccess(null);
                  }}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Sessions Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Sesiones Activas</h2>
            <p className="text-sm text-gray-500">Gestiona tus sesiones activas</p>
          </div>
          <button
            onClick={loadSessions}
            disabled={isLoadingSessions}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <ICONS.RefreshCw size={18} className={isLoadingSessions ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {isLoadingSessions ? (
          <div className="flex items-center justify-center py-8">
            <ICONS.Loader2 className="animate-spin text-indigo-600" size={24} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ICONS.Shield size={32} className="mx-auto mb-2 opacity-50" />
            <p>No hay sesiones activas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ICONS.Monitor size={16} className="text-gray-400" />
                    <span className="text-sm font-semibold text-gray-900">
                      {session.isCurrent ? 'Sesión Actual' : 'Sesión Activa'}
                    </span>
                    {session.isCurrent && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                        Actual
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Creada: {formatDate(session.createdAt, "d 'de' MMMM, yyyy 'a las' HH:mm")}</p>
                    <p>Expira: {formatDate(session.expiresAt, "d 'de' MMMM, yyyy 'a las' HH:mm")}</p>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(session.token)}
                    className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-sm font-semibold hover:bg-rose-100 transition-colors flex items-center gap-1"
                  >
                    <ICONS.X size={14} />
                    Cerrar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Admin Section */}
      {user?.isAdmin && (
        <AdminUsersSection userId={user.id} />
      )}
    </div>
  );
};

// Admin Users Section Component
const AdminUsersSection: React.FC<{ userId: string }> = ({ userId }) => {
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const allUsers = await getAllUsers(userId);
      setUsers(allUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleCreateUser = async () => {
    setCreateError(null);
    setCreateSuccess(null);

    if (!newUserEmail || !newUserName || !newUserPassword) {
      setCreateError('Todos los campos son requeridos');
      return;
    }

    try {
      await createUserAsAdmin(userId, newUserEmail, newUserPassword, newUserName, newUserIsAdmin);
      setCreateSuccess('Usuario creado correctamente');
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setNewUserIsAdmin(false);
      setIsCreatingUser(false);
      await loadUsers();
      setTimeout(() => setCreateSuccess(null), 3000);
    } catch (error: any) {
      setCreateError(error.message || 'Error al crear el usuario');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Administración de Usuarios</h2>
          <p className="text-sm text-gray-500">Gestiona usuarios del sistema</p>
        </div>
        {!isCreatingUser && (
          <button
            onClick={() => setIsCreatingUser(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <ICONS.Plus size={18} />
            Crear Usuario
          </button>
        )}
      </div>

      <AnimatePresence>
        {isCreatingUser && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200"
          >
            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                <ICONS.AlertOctagon size={18} />
                <span>{createError}</span>
              </div>
            )}
            
            {createSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
                <ICONS.CheckCircle size={18} />
                <span>{createSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                placeholder="usuario@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre
              </label>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                placeholder="Nombre completo"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                placeholder="Mínimo 8 caracteres"
                minLength={8}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isAdmin"
                checked={newUserIsAdmin}
                onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <label htmlFor="isAdmin" className="text-sm font-semibold text-gray-700">
                Administrador
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCreateUser}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <ICONS.Check size={18} />
                Crear Usuario
              </button>
              <button
                onClick={() => {
                  setIsCreatingUser(false);
                  setNewUserEmail('');
                  setNewUserName('');
                  setNewUserPassword('');
                  setNewUserIsAdmin(false);
                  setCreateError(null);
                  setCreateSuccess(null);
                }}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Usuarios ({users.length})</h3>
          <button
            onClick={loadUsers}
            disabled={isLoadingUsers}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <ICONS.RefreshCw size={16} className={isLoadingUsers ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {isLoadingUsers ? (
          <div className="flex items-center justify-center py-8">
            <ICONS.Loader2 className="animate-spin text-indigo-600" size={24} />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ICONS.Users size={32} className="mx-auto mb-2 opacity-50" />
            <p>No hay usuarios</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{u.name}</span>
                    {u.isAdmin && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Creado: {formatDate(u.createdAt, "d 'de' MMMM, yyyy")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default UserProfileView;
