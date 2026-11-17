import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SignInCard } from "./SignInCard";

// Font loaders only work inside the Next.js build.
vi.mock("next/font/google", () => ({
  Google_Sans: () => ({ className: "font-google-sans" }),
}));

type Props = Parameters<typeof SignInCard>[0];

const base: Props = {
  churchName: "The NewBreed Church",
  churchInitials: "NB",
  logoUrl: null,
  churchHost: "newbreed.faithflow.app",
  state: { kind: "sign-in" },
  signInAction: async () => {},
  attendanceHref: "/attendance",
  privacyHref: "/privacy",
};

const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(<SignInCard {...base} {...props} />).replaceAll("&#x27;", "'");

/** The markup of the only button on the screen. */
const button = (html: string) => html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];

describe("SignInCard", () => {
  it("shows the church, the title and the Google button", () => {
    const html = render();
    expect(html).toContain("The NewBreed Church");
    expect(html).toContain("Attendance Database");
    expect(html).toContain("Sign in with your approved Google account.");
    expect(html).toContain("Only approved team members can sign in.");

    const buttons = button(html);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain('type="submit"');
    expect(buttons[0]).toContain("Continue with Google");
    expect(buttons[0]).toContain("<svg");
    expect(buttons[0]).not.toContain("bg-primary");
    expect(html).not.toContain('role="alert"');
  });

  it("shows the church initials when there is no logo, and the logo with alt text when there is", () => {
    expect(render()).toMatch(/aria-hidden="true"[^>]*>NB<\/div>/);

    const html = render({ logoUrl: "https://example.com/logo.png" });
    expect(html).toContain('alt="The NewBreed Church logo"');
    expect(html).not.toContain(">NB<");
  });

  it("links to the church's privacy page and credits the platform in the footer", () => {
    const html = render({ privacyHref: "/newbreed/privacy" });
    expect(html).toMatch(/<footer[\s\S]*href="\/newbreed\/privacy"[\s\S]*Privacy[\s\S]*<\/footer>/);
    expect(html).toContain("Powered by GB Tech");
  });

  it("explains a sign-in that is not on the team list, offering the Google account chooser", () => {
    const html = render({ state: { kind: "not-on-team" } });
    expect(html).toContain("We couldn't sign you in.");
    expect(html).not.toContain("Sign in with your approved Google account.");
    expect(html).toMatch(
      /role="alert"[^>]*border-danger[^>]*>This Google account isn't on the team list for The NewBreed Church/,
    );

    const buttons = button(html);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain('type="submit"');
    expect(buttons[0]).toContain("Continue with Google");
    expect(buttons[0]).toContain("<svg");
    expect(buttons[0]).not.toContain("bg-primary");
    expect(html).not.toContain("Use a different account");
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf("<button"));
  });

  it("keeps the other states and their messages", () => {
    expect(render({ state: { kind: "rate-limited" } })).toContain(
      "Too many sign-in attempts. Wait a few minutes and try again.",
    );
    expect(render({ state: { kind: "failed" } })).toContain(
      "Sign-in didn't work. Please try again.",
    );

    const wrongHost = render({ state: { kind: "wrong-host" } });
    expect(wrongHost).toContain("To sign in, open newbreed.faithflow.app.");
    expect(button(wrongHost)).toHaveLength(0);

    const unavailable = render({ state: { kind: "unavailable" } });
    expect(button(unavailable)).toHaveLength(0);
    expect(unavailable).toMatch(/href="\/attendance"[^>]*>Go to attendance/);
  });
});
