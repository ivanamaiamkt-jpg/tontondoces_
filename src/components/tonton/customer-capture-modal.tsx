import { useEffect, useRef, useState } from "react";
import { useOrder } from "@/contexts/order-context";
import { maskPhone } from "@/lib/format";

export function CustomerCaptureModal() {
  const { customerPromptOpen, confirmCustomer } = useOrder();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customerPromptOpen) {
      setName("");
      setPhone("");
      setErrors({});
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [customerPromptOpen]);

  if (!customerPromptOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const digits = phone.replace(/\D/g, "");
    const next: { name?: string; phone?: string } = {};
    if (trimmedName.length < 2) next.name = "Digite seu nome (mín. 2 letras)";
    if (digits.length < 10) next.phone = "Telefone inválido";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    confirmCustomer({ name: trimmedName, phone: digits });
  };

  const inputBase: React.CSSProperties = {
    width: "100%",
    height: 48,
    borderRadius: 12,
    padding: "0 16px",
    fontSize: "1rem",
    fontFamily: "Inter, sans-serif",
    background: "#fff",
    outline: "none",
    transition: "border-color 150ms, box-shadow 150ms",
  };

  const errStyle = (has?: string): React.CSSProperties => ({
    ...inputBase,
    border: `1.5px solid ${has ? "#e63946" : "#e8ddd0"}`,
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "tonton-fade 250ms ease-out",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tonton-capture-title"
    >
      <style>{`
        @keyframes tonton-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tonton-pop {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .tonton-capture-input:focus {
          border-color: #3d1a5e !important;
          box-shadow: 0 0 0 3px rgba(61,26,94,0.1);
        }
        .tonton-capture-btn:hover {
          filter: brightness(0.92);
          transform: scale(1.01);
        }
      `}</style>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          borderRadius: 24,
          padding: "36px 32px",
          maxWidth: 400,
          width: "90%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          animation: "tonton-pop 250ms ease-out",
        }}
      >
        <div style={{ fontSize: "2.5rem", textAlign: "center", marginBottom: 8 }}>
          🍫
        </div>
        <h2
          id="tonton-capture-title"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.4rem",
            color: "#3d1a5e",
            textAlign: "center",
            fontWeight: 600,
            margin: 0,
          }}
        >
          Antes de continuar...
        </h2>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.875rem",
            color: "#7a6a5a",
            textAlign: "center",
            marginTop: 6,
            marginBottom: 24,
          }}
        >
          Preenche rapidinho pra gente guardar seu pedido com carinho 💕
        </p>

        <label
          htmlFor="tonton-name"
          style={{
            display: "block",
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "#3d1a5e",
            marginBottom: 6,
          }}
        >
          Seu nome
        </label>
        <input
          ref={nameRef}
          id="tonton-name"
          className="tonton-capture-input"
          type="text"
          placeholder="Como você se chama?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={errStyle(errors.name)}
          autoComplete="name"
          maxLength={80}
        />
        {errors.name && (
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              color: "#e63946",
              marginTop: 4,
            }}
          >
            {errors.name}
          </p>
        )}

        <label
          htmlFor="tonton-phone"
          style={{
            display: "block",
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "#3d1a5e",
            marginTop: 16,
            marginBottom: 6,
          }}
        >
          WhatsApp
        </label>
        <input
          id="tonton-phone"
          className="tonton-capture-input"
          type="tel"
          inputMode="numeric"
          placeholder="(00) 00000-0000"
          value={phone}
          onChange={(e) => setPhone(maskPhone(e.target.value))}
          style={errStyle(errors.phone)}
          autoComplete="tel"
        />
        {errors.phone && (
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              color: "#e63946",
              marginTop: 4,
            }}
          >
            {errors.phone}
          </p>
        )}

        <button
          type="submit"
          className="tonton-capture-btn"
          style={{
            width: "100%",
            height: 52,
            background: "#c8962a",
            color: "#3d1a5e",
            fontWeight: 700,
            fontSize: "1rem",
            fontFamily: "Inter, sans-serif",
            borderRadius: 14,
            border: "none",
            cursor: "pointer",
            marginTop: 24,
            transition: "filter 150ms ease, transform 150ms ease",
          }}
        >
          Guardar e continuar 🍬
        </button>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "#aaa",
            textAlign: "center",
            marginTop: 12,
            marginBottom: 0,
          }}
        >
          🔒 Seus dados ficam só com a gente
        </p>
      </form>
    </div>
  );
}
