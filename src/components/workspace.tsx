"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Film,
  Plus,
  LogOut,
  Upload,
  ArrowUpRight,
  Clock,
  Scissors,
  ArrowLeft,
  Download,
  RefreshCw,
  Trash2,
  FileText,
  Check,
  Settings,
  Shield,
} from "lucide-react";
import { Brand } from "./brand";
import { authClient } from "@/lib/auth-client";
import type { Segment } from "../../packages/contracts";
import { uploadedPartNumbers } from "@/lib/upload-parts";
type Summary = {
  id: string;
  title: string;
  status: string;
  durationMs: number | null;
  createdAt: string;
  expiresAt: string;
  _count: { clips: number };
};
type Revision = {
  id: string;
  revision: number;
  title: string;
  reason: string;
  startMs: number;
  endMs: number;
  script: string;
  voicePrompt: string;
  layout: string;
  captions: Segment[];
  status: string;
  scriptStale: boolean;
  assets: { id: string; kind: string }[];
};
type Project = Summary & {
  clips: { id: string; currentRevision: number; revisions: Revision[] }[];
  jobs: {
    id: string;
    status: string;
    stage: string;
    errorCode: string | null;
    type: string;
  }[];
  errorCode: string | null;
};
export async function api(path: string, method = "GET", data?: unknown) {
  const r = await fetch(`/api/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await r.json();
  if (!r.ok)
    throw Error(
      result.code?.replaceAll("_", " ").toLowerCase() ?? "Request failed",
    );
  return result;
}
export function Shell({
  children,
  name,
  admin = false,
}: {
  children: React.ReactNode;
  name: string;
  admin?: boolean;
}) {
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <span className="nav-label">YOUR WORKSPACE</span>
        <Link className="side-link active" href="/dashboard">
          <LayoutDashboard size={19} />
          Overview
        </Link>
        <Link className="side-link" href="/dashboard/new">
          <Plus size={19} />
          New project
        </Link>
        <Link className="side-link" href="/dashboard/settings">
          <Settings size={19} />
          Account & usage
        </Link>
        {admin && (
          <Link className="side-link" href="/dashboard/admin">
            <Shield size={19} />
            Operations
          </Link>
        )}
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <Scissors size={24} />
            <h4>
              Small clips.
              <br />
              Big possibilities.
            </h4>
            <p>Your next great moment is already in your video.</p>
          </div>
          <button
            className="side-link logout"
            onClick={async () => {
              await authClient.signOut();
              window.location.assign("/sign-in");
            }}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <span>
            CREATOR STUDIO <span className="header-divider">/</span> WORKSPACE
          </span>
          <div className="user-chip">
            <span>{name.slice(0, 1).toUpperCase()}</span>
            <b>{name}</b>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
export function Dashboard({ name }: { name: string }) {
  const [projects, setProjects] = useState<Summary[]>([]),
    [quota, setQuota] = useState<{
      allowance: number;
      consumed: number;
      reserved: number;
    } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([api("projects"), api("usage")])
      .then(([p, q]) => {
        setProjects(p.projects);
        setQuota(q);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">LET'S MAKE SOMETHING GREAT</span>
          <h1>
            Hello, {name.split(" ")[0]}
            <span className="accent">.</span>
          </h1>
          <p>Your ideas, your videos, your next great clip.</p>
        </div>
        <Link href="/dashboard/new" className="button">
          <Plus size={18} />
          New project
        </Link>
      </div>
      <section className="studio-banner">
        <div>
          <span className="card-kicker">MORE FROM EVERY VIDEO</span>
          <h2>
            Your best moments
            <br />
            are waiting to be found.
          </h2>
          <p>Upload your video. We'll help you find the story.</p>
          <Link href="/dashboard/new" className="button white">
            Let's create <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="banner-art">
          <div className="video-frame">
            <Scissors size={48} />
            <span>YOUR NEXT BIG MOMENT</span>
          </div>
          <div className="timeline-bars">
            {Array.from({ length: 26 }, (_, i) => (
              <i key={i} style={{ height: 12 + ((i * 17) % 44) }} />
            ))}
          </div>
        </div>
      </section>
      <section className="stats">
        <div>
          <Film />
          <span>Projects</span>
          <strong>{projects.length}</strong>
        </div>
        <div>
          <Scissors />
          <span>Clips created</span>
          <strong>{projects.reduce((n, p) => n + p._count.clips, 0)}</strong>
        </div>
        <div>
          <Clock />
          <span>Minutes available</span>
          <strong>
            {quota
              ? Math.max(0, quota.allowance - quota.consumed - quota.reserved)
              : "—"}
            <small> / {quota?.allowance ?? 60}</small>
          </strong>
        </div>
      </section>
      <div className="section-heading">
        <h2>Your projects</h2>
        <span>Make something worth sharing</span>
      </div>
      {error && <p className="notice error">{error}</p>}
      {loading ? (
        <p className="empty">Loading your workspace…</p>
      ) : projects.length ? (
        <div className="project-grid">
          {projects.map((p, i) => (
            <Link
              className="project-card"
              href={`/dashboard/projects/${p.id}`}
              key={p.id}
            >
              <div className={`project-cover cover-${i % 3}`}>
                <Film size={34} />
                <span>
                  {p.durationMs
                    ? `${Math.ceil(p.durationMs / 60000)} MIN`
                    : "VIDEO PROJECT"}
                </span>
              </div>
              <div className="project-card-body">
                <span
                  className={`badge ${p.status === "completed" ? "green" : ""}`}
                >
                  {p.status.replaceAll("_", " ")}
                </span>
                <h3>{p.title}</h3>
                <div>
                  <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                  <span>
                    {p._count.clips} clips <ArrowUpRight size={14} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <Film size={29} />
          </div>
          <h3>Your first story starts here.</h3>
          <p>Bring a video. Leave with moments worth sharing.</p>
          <Link href="/dashboard/new" className="button">
            Upload your first video <Upload size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}
export function NewProject({ storageReady = true }: { storageReady?: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || !storageReady) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      if (file.size > 500_000_000)
        throw Error("Choose a video smaller than 500 MB.");
      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
      const saved = localStorage.getItem(`clipmax-upload:${fingerprint}`);
      let projectId = saved;
      if (!projectId) {
        const p = await api("projects", "POST", {
          title: data.get("title") || file.name,
          rightsConfirmed: data.get("rights") === "on",
          clipCount: Number(data.get("clipCount")),
          layout: data.get("layout"),
        });
        projectId = p.id;
        localStorage.setItem(`clipmax-upload:${fingerprint}`, p.id);
      }
      const upload = await api(`projects/${projectId}/uploads`, "POST", {
        size: file.size,
        fingerprint,
      });
      const current = await api(`uploads/${upload.id}/parts`);
      const completed = uploadedPartNumbers(
        current.parts,
        file.size,
        upload.partSize,
      );
      const count = Math.ceil(file.size / upload.partSize);
      setProgress(Math.round((completed.size / count) * 100));
      for (let part = 1; part <= count; part++) {
        if (!completed.has(part)) {
          let done = false;
          for (let attempt = 0; attempt < 3 && !done; attempt++) {
            try {
              const { url } = await api(
                `uploads/${upload.id}/parts/sign`,
                "POST",
                { partNumber: part },
              );
              const r = await fetch(url, {
                method: "PUT",
                body: file.slice(
                  (part - 1) * upload.partSize,
                  Math.min(file.size, part * upload.partSize),
                ),
              });
              if (!r.ok) throw Error("Part upload failed");
              done = true;
            } catch (e) {
              if (attempt === 2) throw e;
              await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            }
          }
        }
        setProgress(Math.round((part / count) * 100));
      }
      await api(`uploads/${upload.id}/complete`, "POST", {});
      localStorage.removeItem(`clipmax-upload:${fingerprint}`);
      router.push(`/dashboard/projects/${projectId}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Upload failed. Choose the same file to resume.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="content narrow">
      <Link className="back" href="/dashboard">
        <ArrowLeft size={16} />
        Your workspace
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">START WITH YOUR STORY</span>
          <h1>
            Create a project<span className="accent">.</span>
          </h1>
          <p>One video. A whole new set of possibilities.</p>
        </div>
      </div>
      {!storageReady && (
        <p className="notice error" role="alert">
          Video uploads are temporarily unavailable while secure storage is
          being configured. Your account and existing projects are unaffected.
        </p>
      )}
      <form className="panel upload-form" onSubmit={submit}>
        <label className={`dropzone ${file ? "selected" : ""}`}>
          <input
            type="file"
            accept="video/mp4,video/quicktime,.mov"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="upload-icon">
            {file ? <Check size={30} /> : <Upload size={30} />}
          </span>
          <h3>{file ? file.name : "Your next great clip is in here."}</h3>
          <p>
            {file
              ? `${(file.size / 1e6).toFixed(1)} MB · Click to change video`
              : "Click to choose your video"}
          </p>
          <small>MP4 or MOV · 2–30 minutes · Up to 500 MB</small>
        </label>
        <label>
          Project name
          <input
            name="title"
            placeholder="Give your story a name"
            required
            maxLength={120}
          />
        </label>
        <div className="form-row">
          <label>
            Suggested clips
            <select name="clipCount" defaultValue="3">
              <option value="1">1 clip</option>
              <option value="3">3 clips</option>
              <option value="5">5 clips</option>
            </select>
          </label>
          <label>
            Export format
            <select name="layout">
              <option value="original">Original aspect ratio</option>
              <option value="vertical">Vertical 9:16 — padded</option>
            </select>
          </label>
        </div>
        <label className="checkbox">
          <input type="checkbox" name="rights" required />I own this video or
          have permission to upload and process it.
        </label>
        <p className="fine-print">
          Videos and clips expire after 7 days. Narration is delivered as text;
          voice audio is not generated here.
        </p>
        {error && (
          <p className="notice error" role="alert">
            {error}. If the upload was interrupted, choose the same video to resume.
          </p>
        )}
        {busy && (
          <div>
            <div className="progress-track">
              <i style={{ width: `${progress}%` }} />
            </div>
            <p className="fine-print">
              Uploading {progress}% — keep this tab open until upload finishes.
            </p>
          </div>
        )}
        <button className="button" disabled={!file || busy || !storageReady}>
          {busy ? "Uploading…" : "Upload video"} <ArrowUpRight size={17} />
        </button>
      </form>
    </div>
  );
}
export function ProjectView({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  const load = () =>
    api(`projects/${id}`)
      .then(setProject)
      .catch((e) => setError(e.message));
  useEffect(() => {
    let active = true;
    const refresh = () =>
      api(`projects/${id}`)
        .then((p) => {
          if (active) setProject(p);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);
  async function action(path: string, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await api(path, method, {});
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!project)
    return (
      <div className="content">
        <p className={error ? "notice error" : "empty"}>
          {error || "Loading project…"}
        </p>
      </div>
    );
  const active = project.jobs.find((j) =>
    ["queued", "running", "retry_wait"].includes(j.status),
  );
  return (
    <div className="content">
      <Link className="back" href="/dashboard">
        <ArrowLeft size={16} />
        Your projects
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR STORY IN THE MAKING</span>
          <h1>{project.title}</h1>
          <p>
            Expires {new Date(project.expiresAt).toLocaleDateString()} ·{" "}
            {project.durationMs
              ? `${Math.ceil(project.durationMs / 60000)} source minutes`
              : "Verifying your video"}
          </p>
        </div>
        <button
          className="icon-button danger"
          aria-label="Delete project"
          onClick={async () => {
            if (confirm("Delete this project and all its clips?")) {
              setBusy(true);
              try {
                await api(`projects/${id}`, "DELETE");
                router.push("/dashboard");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }
          }}
        >
          <Trash2 size={20} />
        </button>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="panel status-panel">
        <div>
          <span className="badge">{project.status.replaceAll("_", " ")}</span>
          <h3>
            {active
              ? "Your moments are on their way."
              : project.status === "ready"
                ? "Your video is ready. Let’s find its best moments."
                : project.clips.length
                  ? "Make these moments your own."
                  : "Your project is being prepared."}
          </h3>
          <p>
            {active
              ? `Current step: ${active.stage.replaceAll("_", " ")}. You can close this page after upload.`
              : "Review each clip, refine your script, and export when you’re ready."}
          </p>
          {project.errorCode && (
            <p className="notice error">
              {project.errorCode.replaceAll("_", " ").toLowerCase()}
            </p>
          )}
        </div>
        {active ? (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => action(`jobs/${active.id}/cancel`)}
          >
            Cancel job
          </button>
        ) : (
          ["ready", "failed", "cancelled", "partially_completed"].includes(
            project.status,
          ) && (
            <button
              className="button"
              disabled={busy}
              onClick={() => action(`projects/${id}/process`)}
            >
              <Scissors size={18} />
              Generate clips
            </button>
          )
        )}
      </div>
      {project.clips.map((clip) => (
        <ClipEditor
          key={`${clip.id}-${clip.currentRevision}`}
          clipId={clip.id}
          revision={clip.revisions[0]}
          onUpdate={load}
        />
      ))}
    </div>
  );
}
function ClipEditor({
  clipId,
  revision: r,
  onUpdate,
}: {
  clipId: string;
  revision: Revision;
  onUpdate: () => void;
}) {
  const [video, setVideo] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [tab, setTab] = useState("script");
  const asset = r.assets.find((a) => a.kind === "video");
  useEffect(() => {
    let alive = true;
    if (asset)
      api(`assets/${asset.id}/download`, "POST", {})
        .then((x) => {
          if (alive) setVideo(x.url);
        })
        .catch((e) => setError(e.message));
    return () => {
      alive = false;
    };
  }, [asset?.id]);
  async function action(kind: string) {
    setBusy(true);
    setError("");
    try {
      await api(`clips/${clipId}/${kind}`, "POST", {});
      setNote(`${kind === "render" ? "Render" : "Script"} queued.`);
      onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api(`clips/${clipId}`, "PATCH", {
        expectedRevision: r.revision,
        title: f.get("title"),
        startMs: Math.round(Number(f.get("start")) * 1000),
        endMs: Math.round(Number(f.get("end")) * 1000),
        layout: f.get("layout"),
        script: f.get("script"),
        voicePrompt: f.get("voicePrompt"),
        captions: r.captions.map((cue, i) => ({
          ...cue,
          startMs: Math.round(Number(f.get(`cue-start-${i}`)) * 1000),
          endMs: Math.round(Number(f.get(`cue-end-${i}`)) * 1000),
          text: String(f.get(`cue-text-${i}`)),
        })),
      });
      setNote("Saved. Render this revision to update your downloads.");
      onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel clip-editor">
      <div className="clip-preview">
        {video ? (
          <video
            src={video}
            controls
            preload="metadata"
            onError={() =>
              setError(
                "Preview link expired. Refresh the page to load a new link.",
              )
            }
          />
        ) : (
          <div className="video-placeholder">
            <Film size={40} />
            <p>
              {r.status === "pending"
                ? "Ready to render"
                : "Preview unavailable"}
            </p>
          </div>
        )}
        <div className="clip-preview-meta">
          <span className="badge">
            {Math.round((r.endMs - r.startMs) / 1000)} seconds
          </span>
          <span>Revision {r.revision}</span>
        </div>
        <p>{r.reason}</p>
        <div className="download-row">
          {r.assets.map((a) => (
            <button
              key={a.id}
              className="button secondary small"
              onClick={async () => {
                try {
                  const x = await api(
                    `assets/${a.id}/download?attachment=1`,
                    "POST",
                    {},
                  );
                  window.location.assign(x.url);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Download size={15} />
              {a.kind}
            </button>
          ))}
        </div>
        <button
          className="text-link"
          onClick={async () => {
            try {
              await api(`clips/${clipId}/feedback`, "POST", { useful: true });
              setNote("Thanks for your feedback.");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Check size={15} /> This is a useful clip
        </button>
      </div>
      <form onSubmit={save} className="clip-fields">
        <label>
          Clip title
          <input name="title" defaultValue={r.title} required maxLength={120} />
        </label>
        <div className="form-row">
          <label>
            Start (seconds)
            <input
              name="start"
              type="number"
              step="0.001"
              min="0"
              defaultValue={r.startMs / 1000}
              required
            />
          </label>
          <label>
            End (seconds)
            <input
              name="end"
              type="number"
              step="0.001"
              defaultValue={r.endMs / 1000}
              required
            />
          </label>
          <label>
            Format
            <select name="layout" defaultValue={r.layout}>
              <option value="original">Original</option>
              <option value="vertical">Vertical</option>
            </select>
          </label>
        </div>
        <div className="tabs">
          {["script", "voicePrompt", "captions"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={tab === t ? "active" : ""}
            >
              {t === "voicePrompt"
                ? "Voice prompt"
                : t === "captions"
                  ? "Caption timing"
                  : "Narration script"}
            </button>
          ))}
        </div>
        <label className={tab === "script" ? "" : "hidden"}>
          Original commentary
          <textarea name="script" defaultValue={r.script} rows={7} />
        </label>
        <label className={tab === "voicePrompt" ? "" : "hidden"}>
          Copy into your voice-generation tool
          <textarea name="voicePrompt" defaultValue={r.voicePrompt} rows={7} />
        </label>
        <div className={tab === "captions" ? "caption-editor" : "hidden"}>
          <p className="fine-print">
            Times are in seconds from the start of this clip.
          </p>
          {r.captions.map((cue, i) => (
            <div key={cue.id} className="caption-cue">
              <div className="form-row">
                <label>
                  From
                  <input
                    name={`cue-start-${i}`}
                    type="number"
                    min="0"
                    step="0.001"
                    defaultValue={cue.startMs / 1000}
                  />
                </label>
                <label>
                  To
                  <input
                    name={`cue-end-${i}`}
                    type="number"
                    min="0"
                    step="0.001"
                    defaultValue={cue.endMs / 1000}
                  />
                </label>
              </div>
              <label>
                Caption
                <textarea
                  name={`cue-text-${i}`}
                  defaultValue={cue.text}
                  rows={2}
                />
              </label>
            </div>
          ))}
        </div>
        {r.scriptStale && (
          <p className="notice">
            Trim changed. Review or regenerate the script.
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {note && <p className="notice success">{note}</p>}
        <div className="editor-actions">
          <button className="button small" disabled={busy}>
            Save revision
          </button>
          <button
            className="button secondary small"
            type="button"
            disabled={busy}
            onClick={() => action("render")}
          >
            <RefreshCw size={14} />
            Render
          </button>
          <button
            className="text-link"
            type="button"
            disabled={busy}
            onClick={() => action("script")}
          >
            Regenerate script
          </button>
        </div>
      </form>
    </article>
  );
}
export function SettingsView({ email }: { email: string }) {
  const [q, setQ] = useState<{
      allowance: number;
      consumed: number;
      reserved: number;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("usage")
      .then(setQ)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="content narrow">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR CREATIVE SPACE</span>
          <h1>Account & usage.</h1>
        </div>
      </div>
      <div className="panel">
        <h3>{email}</h3>
        <p>Verified creator account</p>
        <hr />
        <h3>Processing minutes</h3>
        <p>
          {q
            ? `${q.consumed} used · ${q.reserved} reserved · ${q.allowance} total allowance`
            : "Loading…"}
        </p>
        <p>
          Your trial allowance is measured in source-video minutes. Files expire
          seven days after project creation.
        </p>
        <Link href="/forgot-password" className="button secondary small">
          Reset password
        </Link>
        {error && <p className="notice error">{error}</p>}
      </div>
    </div>
  );
}
export function AdminView() {
  const [data, setData] = useState<{
      processingEnabled: boolean;
      jobs: {
        id: string;
        type: string;
        status: string;
        stage: string;
        attempt: number;
        errorCode: string | null;
      }[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("admin")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="content">
      <h1>Operations</h1>
      {error && <p className="notice error">{error}</p>}
      <p>
        Processing {data?.processingEnabled ? "enabled" : "paused"}. Change
        PROCESSING_ENABLED on both web and worker to pause admission and paid
        work.
      </p>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Type</th>
              <th>Status</th>
              <th>Stage</th>
              <th>Attempts</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {data?.jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.id.slice(0, 8)}</td>
                <td>{j.type}</td>
                <td>{j.status}</td>
                <td>{j.stage}</td>
                <td>{j.attempt}</td>
                <td>{j.errorCode ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
