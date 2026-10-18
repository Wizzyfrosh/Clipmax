import Link from "next/link";
import {
  ArrowRight,
  Play,
  Scissors,
  FileText,
  Upload,
  Check,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { HomeDetails } from "@/components/home-details";
export default function Home() {
  return (
    <main className="landing">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <header className="landing-nav">
        <Brand />
        <nav>
          <Link href="#how">How it works</Link>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up" className="button small">
            Get started <ArrowRight size={16} />
          </Link>
        </nav>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span /> YOUR NEXT GREAT CLIP STARTS HERE
          </span>
          <h1>
            Long video.
            <br />
            Great moments.
            <br />
            <em>Made short.</em>
          </h1>
          <p>
            Find the moments worth sharing. Turn your videos into short clips,
            captions, and original voice-over scripts — all in one workspace.
          </p>
          <div className="hero-actions">
            <Link href="/sign-up" className="button">
              Create your first clip <ArrowRight size={18} />
            </Link>
            <Link href="/sign-in" className="text-link">
              Welcome back <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hero-notes">
            <span>
              <Check size={15} /> Your footage stays private
            </span>
            <span>
              <Check size={15} /> You're in creative control
            </span>
          </div>
        </div>
        <div className="phone-stage" aria-label="Clipmax interface preview">
          <div className="phone phone-back">
            <div className="phone-top">
              9:41 <span>● ● ▰</span>
            </div>
            <h3>
              Hello,
              <br />
              creator!
            </h3>
            <div className="phone-sheet">
              <span className="mini-label">YOUR NEXT STORY</span>
              <h4>
                One video.
                <br />
                More possibilities.
              </h4>
              <div className="mini-video">
                <Play fill="currentColor" />
              </div>
              <div className="mini-lines">
                <i />
                <i />
                <i />
              </div>
              <span className="mini-pill">FIND MY MOMENTS</span>
            </div>
          </div>
          <div className="phone phone-front">
            <div className="phone-top">
              9:41 <span>● ● ▰</span>
            </div>
            <div className="phone-brand">
              <Scissors size={38} />
              <b>CLIPMAX</b>
              <span>MAKE EVERY MOMENT COUNT</span>
            </div>
            <div className="phone-welcome">
              <h3>
                Welcome to
                <br />
                your next big moment.
              </h3>
              <Link href="/sign-in" className="phone-outline">
                SIGN IN
              </Link>
              <Link href="/sign-up" className="phone-white">
                SIGN UP
              </Link>
            </div>
            <div className="phone-footer">
              Create. Clip. Share.
              <div className="home-indicator" />
            </div>
          </div>
          <div className="floating-note">
            <span>
              <Check size={18} />
            </span>
            <div>
              <b>Made for your story</b>
              <small>Your voice. Your creative direction.</small>
            </div>
          </div>
        </div>
      </section>
      <section id="how" className="how">
        <div>
          <span className="eyebrow">FROM LONG-FORM TO SHARE-WORTHY</span>
          <h2>A simpler way to create.</h2>
        </div>
        <div className="steps">
          {[
            {
              icon: Upload,
              n: "01",
              title: "Bring your video",
              text: "Upload a podcast, tutorial, interview, or sermon you have permission to use.",
            },
            {
              icon: Scissors,
              n: "02",
              title: "Find your moments",
              text: "Review suggested clips and fine-tune the beginning, ending, and captions.",
            },
            {
              icon: FileText,
              n: "03",
              title: "Make it your own",
              text: "Download clips and voice-over scripts, ready for your final edit.",
            },
          ].map((s) => (
            <article key={s.n}>
              <div className="step-icon">
                <s.icon size={21} />
              </div>
              <span className="step-number">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>
      <HomeDetails />
      <footer className="landing-footer">
        <Brand />
        <span>For the moments that deserve more.</span>
        <Link href="/sign-up">
          Start creating <ArrowRight size={15} />
        </Link>
      </footer>
    </main>
  );
}
