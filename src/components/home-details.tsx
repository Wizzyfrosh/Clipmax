"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Captions,
  Check,
  Download,
  FileText,
  LockKeyhole,
  Mic,
  MonitorPlay,
  Scissors,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Video,
} from "lucide-react";
import styles from "./home-details.module.css";

const stories = [
  {
    name: "Podcasters",
    icon: Mic,
    title: "The conversation keeps going.",
    text: "Give a thoughtful answer a life beyond the full episode. Find self-contained moments, keep the speaker’s context, and prepare a clip that invites people into the conversation.",
    example: "The question that changed my approach",
    kind: "A standout answer",
    time: "00:38",
    tags: ["Interviews", "Solo episodes", "Roundtables"],
  },
  {
    name: "Educators",
    icon: MonitorPlay,
    title: "One lesson. A clearer takeaway.",
    text: "Turn an explanation into a focused learning moment. Review the boundaries, correct the captions, and give your audience one useful idea to take away.",
    example: "Start with the problem, not the tool",
    kind: "A practical lesson",
    time: "00:45",
    tags: ["Tutorials", "Workshops", "Course previews"],
  },
  {
    name: "Creators",
    icon: Video,
    title: "Make room for your next idea.",
    text: "Revisit the stories already in your library. Shape a strong opening, refine the ending, and take the clip into your own editing and publishing workflow.",
    example: "What I wish I knew before starting",
    kind: "A personal insight",
    time: "00:32",
    tags: ["Creator interviews", "Commentary", "Personal stories"],
  },
  {
    name: "Ministries",
    icon: AudioLines,
    title: "Carry the message further.",
    text: "Find a complete thought within a sermon or teaching you have permission to share. Keep the meaning intact and review every suggestion before it leaves your workspace.",
    example: "Small acts. Lasting impact.",
    kind: "A reflection to revisit",
    time: "00:52",
    tags: ["Sermons", "Teachings", "Conversations"],
  },
];
const faqs = [
  [
    "What kinds of videos work best?",
    "Clipmax is designed for spoken-content videos: podcasts, interviews, tutorials, and sermons. The initial focus is English speech. Selection follows the transcript, so it does not identify silent action or guarantee visual highlights.",
  ],
  [
    "Can I change the clips that are suggested?",
    "Yes. The review workspace lets you adjust the start and end, edit plain captions, and choose original-ratio or padded vertical output. You decide what is worth sharing.",
  ],
  [
    "Does Clipmax create a voice-over recording?",
    "No. Each clip can include original commentary and a copyable prompt for an external voice-generation service. Source captions and generated commentary are separate. You generate and add voice audio in your own editing workflow.",
  ],
  [
    "What can I upload and download?",
    "The current limits are 2–30 minutes and 500 MB per source, with supported MP4/MOV video and audio codecs. Suggested clips are 20–60 seconds, up to five per project. Download MP4 video, SRT captions, and script/prompt text separately.",
  ],
  [
    "Can I use videos I found online?",
    "Only upload footage you own or have permission to use. Writing a new voice-over does not grant rights to the original footage. Clipmax does not import arbitrary video URLs.",
  ],
  [
    "Is Clipmax open to everyone yet?",
    "Registration is open to everyone. Live processing is still being configured and validated. The previews on this page illustrate the workflow; they are not generated results or a promise of availability.",
  ],
];

export function HomeDetails() {
  const [selected, setSelected] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !root.current ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const nodes = root.current.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.remove(styles.waiting);
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08 },
    );
    nodes.forEach((node) => {
      if (node.getBoundingClientRect().top > window.innerHeight)
        node.classList.add(styles.waiting);
      observer.observe(node);
    });
    return () => {
      observer.disconnect();
      nodes.forEach((node) => node.classList.remove(styles.waiting));
    };
  }, []);
  const story = stories[selected];
  return (
    <div ref={root} className={styles.root}>
      <div className={styles.ribbon} aria-label="Clipmax workflow">
        <span>
          A little less searching. <b>A lot more creating.</b>
        </span>
        <div>
          <span>
            <Scissors size={16} /> Shape the moment
          </span>
          <span>
            <Captions size={16} /> Keep the words
          </span>
          <span>
            <FileText size={16} /> Add your perspective
          </span>
        </div>
      </div>

      <section
        id="workspace"
        className={`${styles.section} ${styles.showcase}`}
        data-reveal
      >
        <div className={styles.heading}>
          <span className="eyebrow">THE MOMENT IS JUST THE BEGINNING</span>
          <h2>
            From a good conversation
            <br />
            to <em>something worth keeping.</em>
          </h2>
          <p>
            A focused workspace for the decisions that make a clip yours. Find
            the thought. Refine the cut. Keep the context.
          </p>
        </div>
        <div className={styles.editor}>
          <div className={styles.editorTop}>
            <span>
              <span className={styles.dots}>● ● ●</span> The creative process /
              Clip review
            </span>
            <span className={styles.previewLabel}>ILLUSTRATIVE PREVIEW</span>
          </div>
          <div className={styles.editorBody}>
            <div className={styles.canvas}>
              <span className={styles.canvasLabel}>
                <Video size={15} /> THE CREATIVE PROCESS
              </span>
              <div className={styles.poster}>
                <span>
                  Good ideas
                  <br />
                  start with
                  <br />
                  <em>better questions.</em>
                </span>
                <div className={styles.posterOrbit} aria-hidden="true" />
              </div>
              <div className={styles.caption}>
                “Give yourself permission to begin.”
              </div>
              <div className={styles.timecode}>
                <span>00:12 / 00:38</span>
                <span>Original ratio · Source audio</span>
              </div>
            </div>
            <div className={styles.inspector}>
              <div>
                <span className={styles.smallLabel}>YOUR SELECTED MOMENT</span>
                <h3>
                  A fresh perspective
                  <br />
                  on getting started.
                </h3>
                <p>
                  A complete idea with a clear opening and a thoughtful ending.
                </p>
              </div>
              <div className={styles.range}>
                <div>
                  <span>START</span>
                  <b>04:12</b>
                </div>
                <ArrowRight size={18} />
                <div>
                  <span>END</span>
                  <b>04:50</b>
                </div>
                <span className={styles.duration}>38 sec</span>
              </div>
              <div className={styles.inspectorRow}>
                <Captions size={18} />
                <span>Source captions</span>
                <Check size={16} />
              </div>
              <div className={styles.inspectorRow}>
                <FileText size={18} />
                <span>Original commentary</span>
                <Check size={16} />
              </div>
              <div className={styles.inspectorNote}>
                <SlidersHorizontal size={16} /> Your final edit. Your call.
              </div>
            </div>
          </div>
          <div className={styles.timeline}>
            <span>04:00</span>
            <div className={styles.wave} aria-hidden="true">
              {Array.from({ length: 64 }, (_, i) => (
                <i
                  key={i}
                  style={{ height: `${14 + ((i * 17 + 11) % 36)}px` }}
                />
              ))}
              <div className={styles.selection}>
                <span>YOUR MOMENT · 38s</span>
              </div>
            </div>
            <span>05:00</span>
          </div>
        </div>
        <div className={styles.featureGrid}>
          {[
            {
              icon: Scissors,
              title: "Keep the strongest part.",
              text: "Suggested ranges give you a starting point. Adjust the timing to preserve the full thought.",
            },
            {
              icon: Captions,
              title: "Let the words travel.",
              text: "Review source captions and export an SRT file for your next editing or publishing step.",
            },
            {
              icon: SlidersHorizontal,
              title: "Stay in the director’s seat.",
              text: "Choose your layout and revise your clip. Suggestions support your judgment; they don’t replace it.",
            },
          ].map((item) => (
            <article key={item.title}>
              <item.icon size={22} />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="creators"
        className={`${styles.section} ${styles.creators}`}
        data-reveal
      >
        <div className={styles.heading}>
          <span className="eyebrow">BUILT AROUND WHAT YOU MAKE</span>
          <h2>
            You bring the story.
            <br />
            <em>We help you find the moment.</em>
          </h2>
        </div>
        <div className={styles.choices} aria-label="Choose a creator use case">
          {stories.map((item, i) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
            >
              <item.icon size={18} />
              {item.name}
            </button>
          ))}
        </div>
        <div className={styles.story} aria-live="polite">
          <div className={styles.storyCopy}>
            <span className={styles.smallLabel}>
              FOR {story.name.toUpperCase()}
            </span>
            <h3>{story.title}</h3>
            <p>{story.text}</p>
            <div className={styles.tags}>
              {story.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <Link href="#how" className="text-link">
              Explore the workflow <ArrowRight size={16} />
            </Link>
          </div>
          <div className={styles.storyVisual} key={selected}>
            <div className={styles.storyCard}>
              <span>
                <story.icon size={19} />
                {story.kind}
              </span>
              <h4>{story.example}</h4>
              <div className={styles.storyWave} aria-hidden="true">
                {Array.from({ length: 28 }, (_, i) => (
                  <i key={i} style={{ height: `${12 + ((i * 13) % 40)}px` }} />
                ))}
              </div>
              <footer>
                <span>EXAMPLE CLIP CONCEPT</span>
                <b>{story.time}</b>
              </footer>
            </div>
            <span className={styles.storyStamp}>
              <Sparkles size={16} /> A small moment. A new possibility.
            </span>
          </div>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.deliverables}`}
        data-reveal
      >
        <div className={styles.deliverableIntro}>
          <span className="eyebrow">MORE THAN A CUT</span>
          <h2>
            One moment.
            <br />
            <em>
              Three ways
              <br />
              to build on it.
            </em>
          </h2>
          <p>
            Take the pieces you need into the tools you already use. Your
            workflow doesn’t have to start over.
          </p>
          <span className={styles.miniNote}>
            <Download size={16} /> Separate files. Creative freedom.
          </span>
        </div>
        <div className={styles.fileStack}>
          {[
            {
              icon: Video,
              format: "MP4",
              title: "The clip",
              text: "A focused video with source audio, in its original ratio or a padded vertical layout.",
            },
            {
              icon: Captions,
              format: "SRT",
              title: "The words",
              text: "Editable source captions, timed relative to your clip and ready for your next editor.",
            },
            {
              icon: FileText,
              format: "TEXT",
              title: "Your next take",
              text: "Original commentary and a voice-generation prompt. Generate voice audio separately.",
            },
          ].map((file, i) => (
            <article key={file.format}>
              <span className={styles.fileIcon}>
                <file.icon size={25} />
              </span>
              <div>
                <span className={styles.smallLabel}>
                  0{i + 1} / {file.format}
                </span>
                <h3>{file.title}</h3>
                <p>{file.text}</p>
              </div>
              <ArrowRight className={styles.fileArrow} size={20} />
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.control}`} data-reveal>
        <div>
          <span className="eyebrow">THOUGHTFUL BY DESIGN</span>
          <h2>
            Your content.
            <br />
            Your context. <em>Your control.</em>
          </h2>
          <p>Good creative tools should make the boundaries clear.</p>
        </div>
        <div className={styles.controlGrid}>
          {[
            {
              icon: LockKeyhole,
              title: "A private workspace",
              text: "Projects belong to your account. Media access uses authorized, temporary download links.",
            },
            {
              icon: ShieldCheck,
              title: "Permission comes first",
              text: "Bring footage you own or have rights to use. New commentary is not copyright clearance.",
            },
            {
              icon: Timer,
              title: "Made for a short stay",
              text: "The planned media retention is seven days. Live cleanup is part of the pilot validation, not a permanent archive.",
            },
            {
              icon: Check,
              title: "A human makes the call",
              text: "Review every cut and caption. No promised virality, invented performance scores, or automatic publishing.",
            },
          ].map((item) => (
            <article key={item.title}>
              <item.icon size={22} />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="questions"
        className={`${styles.section} ${styles.faq}`}
        data-reveal
      >
        <div>
          <span className="eyebrow">A FEW THINGS WORTH KNOWING</span>
          <h2>
            Before your
            <br />
            <em>first clip.</em>
          </h2>
          <p>Clear answers, so you know what you’re creating with.</p>
        </div>
        <div>
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.cta}`} data-reveal>
        <div className={styles.ctaArt} aria-hidden="true">
          <Scissors size={100} />
        </div>
        <span className="eyebrow">LESS FRICTION. MORE CREATIVE DIRECTION.</span>
        <h2>
          Your next great moment
          <br />
          might already be recorded.
        </h2>
        <p>Give your best ideas another place to be heard.</p>
        <Link href="/sign-up" className="button white">
          Explore Clipmax <ArrowRight size={18} />
        </Link>
        <small>
          Open registration · Private projects · Processing setup in progress
        </small>
      </section>
    </div>
  );
}
