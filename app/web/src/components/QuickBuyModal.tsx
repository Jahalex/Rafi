"use client";

import { useEffect, useState } from "react";
import { Pool } from "@/lib/supabase";
import BuySlider from "./BuySlider";
import { X } from "lucide-react";

interface Props {
  pool: Pool | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickBuyModal({ pool, isOpen, onClose }: Props) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 250); // Matches CSS animation duration
  };

  if (!isOpen && !isClosing) return null;
  if (!pool) return null;

  return (
    <>
      <div className="slide-over-overlay" onClick={handleClose} />
      <div className={`slide-over-panel ${isClosing ? "closing" : ""}`}>
        <div className="slide-over-header">
          <h2 className="slide-over-title">Quick Enter</h2>
          <button className="slide-over-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>
        <div className="slide-over-content" style={{ padding: 0 }}>
          {/* BuySlider already has internal padding in its panel, so we remove padding here */}
          <div style={{ padding: 24 }}>
            <BuySlider pool={pool} onMintSuccess={handleClose} />
          </div>
        </div>
      </div>
    </>
  );
}
