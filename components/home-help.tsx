import { homeCopy } from '@/lib/copy';
import { guidePaths, type HomePath } from '@/lib/seo';

export function HomeHelp({ home = '/' }: { home?: HomePath }) {
  const { help, footer } = homeCopy[home];
  return (
    <section className="home-help" aria-labelledby="how-heading">
      <h2 id="how-heading">{help.heading}</h2>
      <p>{help.intro}</p>
      <ol className="how-steps">
        {help.steps.map((step) => (
          <li key={step.title}>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
      <div className="home-questions">
        <h2>{help.questions}</h2>
        {help.faq.map(({ question, answer, link }) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>
              {answer}
              {link && <a href={link.href}>{link.text}</a>}
              {link?.after}
            </p>
          </details>
        ))}
      </div>
      <nav className="guide-links" aria-label={help.guides}>
        {guidePaths.map((path) => (
          <a key={path} href={path}>
            {footer.guides[path]}
            <span aria-hidden="true"> →</span>
          </a>
        ))}
      </nav>
      {help.guidesNote && <p>{help.guidesNote}</p>}
    </section>
  );
}
