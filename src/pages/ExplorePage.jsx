import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'

export default function ExplorePage() {
  const [noteSets, setNoteSets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('note_sets')
          .select('id, title, created_at, english_level, fork_count, owner_id')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(50)
        if (error) throw error
        setNoteSets(data ?? [])
      } catch (err) {
        toast.error('Failed to load: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const levelColor = {
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-blue-100 text-blue-700',
    advanced: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Explore Note Sets</h1>
          <p className="text-gray-500 text-sm mt-1">Publicly shared study materials — fork any to make it your own</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : noteSets.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No public note sets yet. Be the first!</div>
        ) : (
          <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
            {noteSets.map(n => (
              <Link
                key={n.id}
                to={`/notes/${n.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* File icon */}
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-blue-600 group-hover:underline truncate">{n.title}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${levelColor[n.english_level] ?? 'bg-gray-100 text-gray-600'}`}>
                    {n.english_level}
                  </span>
                  {n.fork_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      {n.fork_count}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
