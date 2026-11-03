// client/src/components/Footer.tsx
import { Youtube, Instagram, Linkedin, Twitter, MapPin, Mail, Phone } from "lucide-react";

export function Footer() {
    const socialLinks = [
        {
            name: "YouTube",
            icon: Youtube,
            url: "https://www.youtube.com/channel/UCZqVuyZcSBA6oPB9YAm-cYg/videos",
            color: "hover:text-red-500"
        },
        {
            name: "Instagram",
            icon: Instagram,
            url: "https://www.instagram.com/mca21india/",
            color: "hover:text-pink-500"
        },
        {
            name: "LinkedIn",
            icon: Linkedin,
            url: "https://www.linkedin.com/company/mca21india/",
            color: "hover:text-blue-600"
        },
        {
            name: "X (Twitter)",
            icon: Twitter,
            url: "https://x.com/MCA21India",
            color: "hover:text-blue-400"
        }
    ];

    const getToKnowLinks = [
        { label: "Partner Companies", href: "#partners" },
        { label: "Guidelines", href: "#guidelines" },
        { label: "FAQs", href: "#faqs" },
        { label: "Manuals", href: "#manuals" },
        { label: "Videos", href: "#videos" },
        { label: "Privacy Policy", href: "#privacy" }
    ];

    return (
        <footer id="contact-section" className="bg-card border-t mt-16">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Follow Us */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Follow Us</h3>
                        <div className="flex gap-3">
                            {socialLinks.map((social) => (
                                <a
                                    key={social.name}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`p-3 rounded-full bg-primary/10 text-primary transition-all ${social.color}`}
                                    aria-label={social.name}
                                >
                                    <social.icon className="h-5 w-5" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Get to Know */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Get to Know</h3>
                        <ul className="space-y-2">
                            {getToKnowLinks.map((link) => (
                                <li key={link.label}>
                                    <a
                                        href={link.href}
                                        className="text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Us */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 mt-1 flex-shrink-0 text-primary" />
                                <p>A Wing, 5th Floor, Shastri Bhawan, Dr Rajendra Prasad Rd, New Delhi-110001</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 flex-shrink-0 text-primary" />
                                <a href="mailto:pminternship@mca.gov.in" className="hover:text-primary transition-colors">
                                    pminternship@mca.gov.in
                                </a>
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 flex-shrink-0 text-primary" />
                                <a href="tel:1800116090" className="hover:text-primary transition-colors">
                                    1800 11 6090
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Download App */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Download App</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Click the button below to download the app or scan the QR code.
                        </p>
                        <a
                            href="https://play.google.com/store/apps/details?id=com.mca.pm_internship"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors mb-4"
                        >
                            GET IT ON Google Play
                        </a>
                        <div className="mt-4">
                            <img
                                src="/images/qr-code-play-store.png"
                                alt="Download QR Code"
                                className="w-32 h-32 rounded-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
                    © {new Date().getFullYear()} Prime Minister Internship Scheme (PMIS) | All Rights Reserved
                </div>
            </div>
        </footer>
    );
}
