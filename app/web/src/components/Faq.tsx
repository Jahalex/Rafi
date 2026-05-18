"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "Is Rafi truly fair?",
    a: "Yes. Rafi uses Switchboard Verifiable Random Function (VRF) directly on the Solana blockchain. No human, bot, or developer can predict or manipulate the outcome. The math is completely transparent."
  },
  {
    q: "What happens if a market doesn't fill?",
    a: "If a market doesn't reach 100% capacity before the expiration date, the draw does not happen. All participants can instantly claim a full refund of their USDC directly from the smart contract."
  },
  {
    q: "Is there a house edge?",
    a: "No. Unlike traditional casinos, Rafi takes a flat 6% protocol fee on successful pools. The remaining 94% is pure probability math. You pay exactly for the mathematical chance you get."
  },
  {
    q: "Do I need to connect my wallet?",
    a: "You can browse markets freely, but to enter a draw, you must connect a Solana wallet (like Phantom or Solflare) or log in with an email to automatically generate an embedded non-custodial wallet."
  }
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="seo-section faq-section">
      <div className="seo-header">
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about on-chain probability.</p>
      </div>
      <div className="faq-list">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className={`faq-item ${isOpen ? "open" : ""}`}>
              <button 
                className="faq-q" 
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                {item.q}
                <ChevronDown size={16} className={`faq-icon ${isOpen ? "open" : ""}`} />
              </button>
              <div className="faq-a-wrap" style={{ height: isOpen ? "auto" : 0 }}>
                <div className="faq-a">
                  {item.a}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
