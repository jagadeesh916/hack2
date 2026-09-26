import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'

function FlipCard({ question, answer }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      className="perspective w-full cursor-pointer select-none"
      style={{ height: '220px' }}
      onClick={() => setFlipped(f => !f)}
    >
      <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>
        {/* Front */}
        <div className="flip-card-front rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6 text-center">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Question</span>
          <p className="text-lg font-semibold text-gray-800">{question}</p>
          <span className="text-xs text-gray-400 mt-4">Click to reveal answer</span>
        </div>
        {/* Back */}
        <div className="flip-card-back rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 flex flex-col items-center justify-center p-6 text-center">
          <span className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-3">Answer</span>
          <p className="text-lg font-semibold text-gray-800">{answer}</p>
          <span className="text-xs text-gray-400 mt-4">Click to flip back</span>
        </div>
      </div>
    </div>
  )
}

export default function ViewNotePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [noteSet, setNoteSet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentCard, setCurrentCard] = useState(0)
  const [forking, setForking] = useState(false)

  const fetchNoteSet = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('note_sets')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setNoteSet(data)
    } catch (err) {
      toast.error('Could not load note set: ' + (err.message || 'Not found'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchNoteSet()
  }, [fetchNoteSet])

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied to clipboard!')
  }

  const handleFork = async () => {
    if (!user) {
      toast.error('Sign in to fork this note set')
      navigate('/auth')
      return
    }
    setForking(true)
    try {
      const { data, error } = await supabase
        .from('note_sets')
        .insert({
          owner_id: user.id,
          title: `Fork of ${noteSet.title}`,
          raw_notes: noteSet.raw_notes,
          english_level: noteSet.english_level,
          generated_content: noteSet.generated_content,
          is_public: true,
        })
        .select('id')
        .single()

      if (error) throw error
      toast.success('Forked! Redirecting to your copy…')
      navigate(`/notes/${data.id}`)
    } catch (err) {
      toast.error('Fork failed: ' + (err.message || 'Unknown error'))
    } finally {
      setForking(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center mt-20">
          <div className="text-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-gray-500">Loading note set…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!noteSet) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center mt-20">
          <p className="text-gray-500">Note set not found.</p>
        </div>
      </div>
    )
  }

  const flashcards = noteSet.generated_content?.flashcards ?? []
  const story = noteSet.generated_content?.story ?? ''
  const isOwner = user?.id === noteSet.owner_id
  const canFork = !isOwner && noteSet.is_public

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{noteSet.title}</h1>
            <p className="text-sm text-gray-400 mt-1 capitalize">
              {noteSet.english_level} level • {new Date(noteSet.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={copyLink}>
              📋 Copy Link
            </Button>
            {canFork && (
              <Button size="sm" onClick={handleFork} disabled={forking}>
                {forking ? 'Forking…' : '🍴 Fork This'}
              </Button>
            )}
            {isOwner && (
              <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
                ← Dashboard
              </Button>
            )}
          </div>
        </div>

        {/* Flashcards */}
        {flashcards.length > 0 ? (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Flashcards ({currentCard + 1} / {flashcards.length})
            </h2>
            <FlipCard
              key={currentCard}
              question={flashcards[currentCard].question}
              answer={flashcards[currentCard].answer}
            />
            <div className="flex justify-between mt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentCard(c => Math.max(0, c - 1))}
                disabled={currentCard === 0}
              >
                ← Previous
              </Button>
              <span className="text-sm text-gray-400 self-center">
                {flashcards.length} cards total
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentCard(c => Math.min(flashcards.length - 1, c + 1))}
                disabled={currentCard === flashcards.length - 1}
              >
                Next →
              </Button>
            </div>
          </section>
        ) : (
          <div className="mb-10 p-8 bg-yellow-50 border border-yellow-200 rounded-lg text-center text-yellow-700">
            No flashcards generated yet.
          </div>
        )}

        {/* Mnemonic Story */}
        {story && (
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">🧠 Mnemonic Story</h2>
            <Card>
              <CardContent className="pt-6">
                <p className="text-gray-700 leading-relaxed">{story}</p>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Raw notes accordion */}
        <details className="mt-8 border border-gray-200 rounded-lg">
          <summary className="px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
            View Original Notes
          </summary>
          <div className="px-4 pb-4">
            <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">{noteSet.raw_notes}</pre>
          </div>
        </details>
      </div>
    </div>
  )
}
