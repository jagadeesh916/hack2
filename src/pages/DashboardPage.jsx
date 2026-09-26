import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [noteSets, setNoteSets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNoteSets()
  }, [])

  const fetchNoteSets = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('note_sets')
        .select('id, title, created_at, english_level, is_public')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNoteSets(data ?? [])
    } catch (err) {
      toast.error('Failed to load notes: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this note set?')) return
    try {
      const { error } = await supabase.from('note_sets').delete().eq('id', id)
      if (error) throw error
      setNoteSets(prev => prev.filter(n => n.id !== id))
      toast.success('Deleted')
    } catch (err) {
      toast.error('Delete failed: ' + (err.message || 'Error'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Note Sets</h1>
            <p className="text-sm text-gray-500 mt-1">{user?.email}</p>
          </div>
          <Button onClick={() => navigate('/create')}>
            + New Note Set
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : noteSets.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg mb-4">No note sets yet.</p>
            <Button onClick={() => navigate('/create')}>Create your first one</Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {noteSets.map(noteSet => (
              <Link key={noteSet.id} to={`/notes/${noteSet.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-5 pb-4 flex flex-col h-full">
                    <h2 className="font-semibold text-gray-800 text-base leading-snug line-clamp-2 mb-2">
                      {noteSet.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-auto">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">
                        {noteSet.english_level}
                      </span>
                      {noteSet.is_public && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Public
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(noteSet.created_at).toLocaleDateString()}
                    </p>
                    <button
                      className="mt-3 text-xs text-red-400 hover:text-red-600 text-left"
                      onClick={(e) => handleDelete(noteSet.id, e)}
                    >
                      Delete
                    </button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
