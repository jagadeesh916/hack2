import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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
        <div className="flip-card-front rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6 text-center">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Question</span>
          <p className="text-lg font-semibold text-gray-800">{question}</p>
          <span className="text-xs text-gray-400 mt-4">Click to reveal answer</span>
        </div>
        <div className="flip-card-back rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 flex flex-col items-center justify-center p-6 text-center">
          <span className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-3">Answer</span>
          <p className="text-lg font-semibold text-gray-800">{answer}</p>
          <span className="text-xs text-gray-400 mt-4">Click to flip back</span>
        </div>
      </div>
    </div>
  )
}

function Avatar({ email, size = 8 }) {
  const letter = email ? email[0].toUpperCase() : '?'
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500']
  const color = colors[email?.charCodeAt(0) % colors.length] ?? 'bg-gray-400'
  return (
    <div className={`${color} text-white rounded-full w-${size} h-${size} flex items-center justify-center font-bold text-sm flex-shrink-0`}>
      {letter}
    </div>
  )
}

export default function ViewNotePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [noteSet, setNoteSet] = useState(null)
  const [ownerEmail, setOwnerEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentCard, setCurrentCard] = useState(0)
  const [forking, setForking] = useState(false)
  const [copied, setCopied] = useState(false)

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

      // Fetch owner email from profiles view (auth.users is not public, use a trick)
      // We store email on note_sets indirectly via owner_id — fetch it from the user's own session if owner
      if (data.owner_id === user?.id) {
        setOwnerEmail(user.email)
      } else {
        // For public viewers, show truncated owner id as handle
        setOwnerEmail(`user-${data.owner_id.slice(0, 8)}`)
      }
    } catch (err) {
      toast.error('Could not load note set: ' + (err.message || 'Not found'))
    } finally {
      setLoading(false)
    }
  }, [id, user])

  useEffect(() => {
    fetchNoteSet()
  }, [fetchNoteSet])

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
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
          forked_from: noteSet.id,
        })
        .select('id')
        .single()
      if (error) throw error
      // Update local fork count optimistically
      setNoteSet(prev => ({ ...prev, fork_count: (prev.fork_count ?? 0) + 1 }))
      toast.success('Forked! Opening your copy…')
      navigate(`/notes/${data.id}`)
    } catch (err) {
      toast.error('Fork failed: ' + (err.message || 'Unknown error'))
    } finally {
      setForking(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center mt-24">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    </div>
  )

  if (!noteSet) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center mt-24">
        <p className="text-gray-500">Note set not found.</p>
      </div>
    </div>
  )

  const flashcards = noteSet.generated_content?.flashcards ?? []
  const story = noteSet.generated_content?.story ?? ''
  const isOwner = user?.id === noteSet.owner_id
  const canFork = !isOwner && noteSet.is_public
  const handle = isOwner ? user.email : ownerEmail
  const shortHandle = handle.includes('@') ? handle.split('@')[0] : handle

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* GitHub-style repo header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-3 flex-wrap">
            <Avatar email={handle} size={6} />
            <Link to={isOwner ? '/dashboard' : '#'} className="font-semibold text-blue-600 hover:underline">
              {shortHandle}
            </Link>
            <span className="text-gray-400">/</span>
            <span className="font-bold text-gray-900 truncate max-w-xs">{noteSet.title}</span>
            <span className="text-xs border border-gray-300 text-gray-500 px-1.5 py-0.5 rounded-full ml-1">
              {noteSet.is_public ? 'Public' : 'Private'}
            </span>
            {noteSet.forked_from && (
              <span className="text-xs text-gray-400 ml-1">
                forked from{' '}
                <Link to={`/notes/${noteSet.forked_from}`} className="text-blue-500 hover:underline">
                  original
                </Link>
              </span>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 text-sm border border-gray-300 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {copied ? 'Copied!' : 'Copy link'}
            </button>

            {canFork && (
              <button
                onClick={handleFork}
                disabled={forking}
                className="flex items-center gap-1.5 text-sm border border-gray-300 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {forking ? 'Forking…' : 'Fork'}
                <span className="ml-1 bg-gray-200 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">
                  {noteSet.fork_count ?? 0}
                </span>
              </button>
            )}

            {isOwner && (
              <span className="flex items-center gap-1.5 text-sm border border-gray-200 px-3 py-1.5 rounded-md text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Forks
                <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                  {noteSet.fork_count ?? 0}
                </span>
              </span>
            )}

            <span className="flex items-center gap-1.5 text-sm text-gray-400 ml-auto">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {new Date(noteSet.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              <span className="ml-2 capitalize border border-gray-200 text-xs px-2 py-0.5 rounded-full">
                {noteSet.english_level}
              </span>
            </span>
          </div>
        </div>

        {/* Tab bar like GitHub */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-0 border-b border-gray-200 -mb-px">
            <div className="flex items-center gap-1.5 px-4 py-2 border-b-2 border-blue-600 text-sm font-medium text-gray-900">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Study
              <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{flashcards.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Main — flashcards + story */}
        <div className="lg:col-span-2 space-y-8">
          {flashcards.length > 0 ? (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">
                  Flashcards <span className="text-gray-400 font-normal text-sm">({currentCard + 1}/{flashcards.length})</span>
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentCard(c => Math.max(0, c - 1))}
                    disabled={currentCard === 0}
                    className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 disabled:opacity-40"
                  >← Prev</button>
                  <button
                    onClick={() => setCurrentCard(c => Math.min(flashcards.length - 1, c + 1))}
                    disabled={currentCard === flashcards.length - 1}
                    className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 disabled:opacity-40"
                  >Next →</button>
                </div>
              </div>
              <FlipCard
                key={currentCard}
                question={flashcards[currentCard].question}
                answer={flashcards[currentCard].answer}
              />
              {/* Card dots */}
              <div className="flex justify-center gap-1.5 mt-4">
                {flashcards.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentCard(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === currentCard ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'}`}
                  />
                ))}
              </div>
            </section>
          ) : (
            <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg text-center text-yellow-700 text-sm">
              No flashcards generated yet.
            </div>
          )}

          {story && (
            <section>
              <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span>🧠</span> Mnemonic Story
              </h2>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-gray-700 leading-relaxed text-sm">{story}</p>
                </CardContent>
              </Card>
            </section>
          )}
        </div>

        {/* Sidebar — like GitHub's right panel */}
        <div className="space-y-5">
          {/* About */}
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">About</h3>
            <p className="text-sm text-gray-600 mb-3 italic">"{noteSet.title}"</p>
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="capitalize">{noteSet.english_level} level</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span>{noteSet.fork_count ?? 0} forks</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{flashcards.length} flashcards</span>
              </div>
            </div>
          </div>

          {/* Share link box */}
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Share this note set</h3>
            <div className="flex gap-2">
              <input
                readOnly
                value={window.location.href}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-600 truncate"
              />
              <button
                onClick={copyLink}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors"
              >
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Raw notes */}
          <details className="border border-gray-200 rounded-lg bg-white">
            <summary className="px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50 rounded-lg">
              📄 Original Notes
            </summary>
            <div className="px-4 pb-4 pt-2 border-t border-gray-100">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">{noteSet.raw_notes}</pre>
            </div>
          </details>

          {/* Fork CTA for non-owners */}
          {canFork && (
            <Button className="w-full" onClick={handleFork} disabled={forking}>
              {forking ? 'Forking…' : '🍴 Fork this note set'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
