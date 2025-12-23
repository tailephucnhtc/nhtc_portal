import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Mail, Lock, Loader2 } from 'lucide-react'

export default function Login() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const handleAuth = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')
        setError('')

        try {
            let signInEmail = email

            // Nếu không phải định dạng email, thử tìm trong bảng profiles
            if (!email.includes('@')) {
                const { data, error: profileError } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', email) // Tìm theo cột username
                    .single()

                if (profileError || !data) {
                    throw new Error('Không tìm thấy tên tài khoản này!')
                }
                signInEmail = data.email
            }

            const { error } = await supabase.auth.signInWithPassword({
                email: signInEmail,
                password,
            })
            if (error) throw error
        } catch (error) {
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setLoading(true)
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {

                    queryParams: {
                        hd: 'nhtc.com.vn',
                        prompt: 'select_account'
                    }
                }
            })
            if (error) throw error
        } catch (error) {
            setError(error.message)
            setLoading(false)
        }
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <img src="/nhtc.png" alt="NHTC Logo" className="login-logo" style={{ maxHeight: '150px', marginBottom: '20px' }} />
                    <h1>Chào Mừng Trở Lại</h1>
                    <p>Đăng nhập để truy cập Dashboard</p>
                </div>

                <button
                    type="button"
                    className="google-button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                >
                    <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                            <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                            <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                            <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.734 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                            <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.799 L -6.734 42.379 C -8.804 40.439 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                        </g>
                    </svg>
                    Đăng nhập bằng Google
                </button>

                <div className="divider">
                    <span>HOẶC</span>
                </div>

                <form onSubmit={handleAuth} className="login-form" autoComplete="off">
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Tên tài khoản"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="off"
                            name="email_new_field"
                            style={{ paddingLeft: '1rem' }}
                        />
                    </div>

                    <div className="input-group">
                        <Lock className="input-icon" size={20} />
                        <input
                            type="password"
                            placeholder="Mật khẩu"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                            name="password_new_field"
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {message && <div className="success-message">{message}</div>}

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? <Loader2 className="spinner" size={20} /> : 'Đăng Nhập'}
                    </button>
                </form>


            </div>
        </div>
    )
}
