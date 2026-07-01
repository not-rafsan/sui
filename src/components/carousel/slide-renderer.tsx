'use client';

import React from 'react';

export interface CoverSlide {
  type: 'cover';
  title: string;
  subtitle: string;
  accentText?: string;
}

export interface ContentSlide {
  type: 'content';
  chapterNumber: number;
  title: string;
  subtitle: string;
  bulletPoints: string[];
  earningPotential: string;
}

export interface CTASlide {
  type: 'cta';
  title: string;
  subtitle: string;
  accentText?: string;
}

export type SlideData = CoverSlide | ContentSlide | CTASlide;

interface SlideRendererProps {
  slide: SlideData;
  width?: number;
  height?: number;
  editable?: boolean;
  onEdit?: (path: string, value: string) => void;
  scale?: number;
  index?: number;
  totalSlides?: number;
}

/* ── Shared background — exact match to reference ── */
function SlideBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Large circle — top right */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        right: '-10%',
        width: '45%',
        height: '45%',
        borderRadius: '50%',
        border: '1.5px solid rgba(255,255,255,0.10)',
      }} />
      {/* Large circle — bottom left */}
      <div style={{
        position: 'absolute',
        bottom: '-12%',
        left: '-8%',
        width: '40%',
        height: '40%',
        borderRadius: '50%',
        border: '1.5px solid rgba(255,255,255,0.07)',
      }} />
      {/* Scattered dots — top-left area */}
      {[
        { x: 5, y: 8 }, { x: 12, y: 14 }, { x: 20, y: 6 }, { x: 8, y: 20 },
        { x: 16, y: 10 }, { x: 25, y: 16 }, { x: 10, y: 28 },
      ].map((d, i) => (
        <div key={`tl${i}`} style={{
          position: 'absolute',
          left: `${d.x}%`,
          top: `${d.y}%`,
          width: 3,
          height: 3,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.18)',
        }} />
      ))}
      {/* Scattered dots — bottom-right area */}
      {[
        { x: 80, y: 75 }, { x: 88, y: 82 }, { x: 75, y: 88 }, { x: 92, y: 78 },
        { x: 84, y: 90 }, { x: 70, y: 80 }, { x: 90, y: 70 },
      ].map((d, i) => (
        <div key={`br${i}`} style={{
          position: 'absolute',
          left: `${d.x}%`,
          top: `${d.y}%`,
          width: 2.5,
          height: 2.5,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.14)',
        }} />
      ))}
    </div>
  );
}

/* ── Editable Text ── */
function EditableText({
  text, path, editable, onEdit, style, tag: Tag = 'div',
}: {
  text: string;
  path: string;
  editable?: boolean;
  onEdit?: (p: string, v: string) => void;
  style?: React.CSSProperties;
  tag?: 'div' | 'span' | 'p' | 'h1' | 'h2';
}) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(text);

  React.useEffect(() => { setVal(text); }, [text]);

  if (editable && onEdit && editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { onEdit(path, val); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { onEdit(path, val); setEditing(false); } }}
        style={{
          ...style,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.25)',
          color: '#fff',
          outline: 'none',
          padding: '4px 10px',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          fontWeight: 'inherit',
          letterSpacing: 'inherit',
          textTransform: 'inherit',
          width: '85%',
          textAlign: (style?.textAlign as 'left' | 'center') || 'left',
        }}
      />
    );
  }

  return (
    <Tag
      style={editable && onEdit ? { ...style, cursor: 'text' } : style}
      onClick={editable && onEdit ? () => setEditing(true) : undefined}
    >
      {text}
    </Tag>
  );
}

/* ── COVER SLIDE — centered title + subtitle below line (matches reference) ── */
function CoverSlideComponent({ slide, editable, onEdit }: { slide: CoverSlide; editable?: boolean; onEdit?: (p: string, v: string) => void }) {
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '8%', boxSizing: 'border-box', textAlign: 'center',
    }}>
      <SlideBackground />

      {/* Small accent tag above title */}
      {slide.accentText && (
        <EditableText
          text={slide.accentText}
          path="accentText"
          editable={editable}
          onEdit={onEdit}
          tag="p"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '2.8%',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.40)',
            letterSpacing: '0.45em',
            textTransform: 'uppercase',
            marginBottom: '4%',
            position: 'relative', zIndex: 1,
          }}
        />
      )}

      {/* Main title — large, centered, bold, uppercase */}
      <EditableText
        text={slide.title}
        path="title"
        editable={editable}
        onEdit={onEdit}
        tag="h1"
        style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: '8.5%',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.04em',
          lineHeight: 1.15,
          textTransform: 'uppercase',
          position: 'relative', zIndex: 1,
          maxWidth: '90%',
        }}
      />

      {/* Divider line */}
      <div style={{
        width: '35%',
        height: '2px',
        backgroundColor: 'rgba(255,255,255,0.25)',
        margin: '5% 0',
        position: 'relative', zIndex: 1,
      }} />

      {/* Subtitle */}
      <EditableText
        text={slide.subtitle}
        path="subtitle"
        editable={editable}
        onEdit={onEdit}
        tag="p"
        style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: '3.6%',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          position: 'relative', zIndex: 1,
        }}
      />
    </div>
  );
}

/* ── CONTENT SLIDE — CHAPTER XX centered + underline + bullet points (matches reference) ── */
function ContentSlideComponent({ slide, editable, onEdit }: { slide: ContentSlide; editable?: boolean; onEdit?: (p: string, v: string) => void }) {
  const bullets = Array.isArray(slide.bulletPoints) ? slide.bulletPoints : [];

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      padding: '8% 12%', boxSizing: 'border-box',
    }}>
      <SlideBackground />

      {/* CHAPTER XX — centered at top area */}
      <div style={{
        textAlign: 'center',
        marginBottom: '3%',
        position: 'relative', zIndex: 1,
      }}>
        <EditableText
          text={`CHAPTER ${String(slide.chapterNumber).padStart(2, '0')}`}
          path="chapterNumber"
          editable={editable}
          onEdit={onEdit}
          tag="h2"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '9%',
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '0.08em',
            lineHeight: 1.1,
          }}
        />
      </div>

      {/* Underline below chapter */}
      <div style={{
        width: '60%',
        height: '2px',
        backgroundColor: 'rgba(255,255,255,0.25)',
        marginBottom: '6%',
        position: 'relative', zIndex: 1,
      }} />

      {/* Bullet points with ● markers — left aligned */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        gap: '3.5%',
        width: '100%',
        position: 'relative', zIndex: 1,
        flex: 1,
        justifyContent: 'flex-start',
        paddingTop: '2%',
      }}>
        {bullets.map((point: string, i: number) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '3%',
          }}>
            {/* Filled circle bullet marker */}
            <span style={{
              color: '#ffffff',
              fontSize: '2.8%',
              lineHeight: 1.6,
              flexShrink: 0,
              marginTop: '0.3%',
              fontFamily: 'system-ui, sans-serif',
            }}>●</span>
            <EditableText
              text={typeof point === 'string' ? point : String(point)}
              path={`bulletPoints.${i}`}
              editable={editable}
              onEdit={onEdit}
              tag="div"
              style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: '3.4%',
                fontWeight: 400,
                color: 'rgba(255,255,255,0.82)',
                lineHeight: 1.5,
                letterSpacing: '0.015em',
                flex: 1,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── CTA SLIDE — SAVE TO START centered (matches reference) ── */
function CTASlideComponent({ slide, editable, onEdit }: { slide: CTASlide; editable?: boolean; onEdit?: (p: string, v: string) => void }) {
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '8%', boxSizing: 'border-box', textAlign: 'center',
    }}>
      <SlideBackground />

      {/* Main CTA text */}
      <EditableText
        text={slide.title}
        path="title"
        editable={editable}
        onEdit={onEdit}
        tag="h1"
        style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: '9%',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          lineHeight: 1.1,
          position: 'relative', zIndex: 1,
          width: '100%',
        }}
      />

      {/* Divider */}
      <div style={{
        width: '30%',
        height: '2px',
        backgroundColor: 'rgba(255,255,255,0.25)',
        margin: '5% 0',
        position: 'relative', zIndex: 1,
      }} />

      {/* Follow text */}
      <EditableText
        text={slide.subtitle}
        path="subtitle"
        editable={editable}
        onEdit={onEdit}
        tag="p"
        style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: '3.2%',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          position: 'relative', zIndex: 1,
        }}
      />

      {/* Optional accent */}
      {slide.accentText && (
        <EditableText
          text={slide.accentText}
          path="accentText"
          editable={editable}
          onEdit={onEdit}
          tag="p"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '2.4%',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.20)',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            marginTop: '5%',
            position: 'relative', zIndex: 1,
          }}
        />
      )}
    </div>
  );
}

/* ── Main SlideRenderer ── */
export default function SlideRenderer({ slide, width = 1080, height = 1350, editable, onEdit, scale = 1, index, totalSlides }: SlideRendererProps) {
  const outerStyle: React.CSSProperties = {
    width: width * scale,
    height: height * scale,
    flexShrink: 0,
    borderRadius: scale < 1 ? 8 : 0,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
    boxShadow: scale < 1 ? '0 4px 24px rgba(0,0,0,0.6)' : 'none',
  };

  const innerStyle: React.CSSProperties = {
    width,
    height,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  };

  const handleEdit = (path: string, value: string) => {
    if (onEdit && index !== undefined) {
      if (path.startsWith('bulletPoints.')) {
        const bpIndex = parseInt(path.split('.')[1], 10);
        const updatedSlide = { ...slide };
        if (updatedSlide.type === 'content') {
          const newBullets = [...updatedSlide.bulletPoints];
          newBullets[bpIndex] = value;
          onEdit(`slides.${index}.bulletPoints`, JSON.stringify(newBullets));
        }
      } else if (path === 'chapterNumber') {
        onEdit(`slides.${index}.chapterNumber`, value);
      } else {
        onEdit(`slides.${index}.${path}`, value);
      }
    }
  };

  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        {slide.type === 'cover' && <CoverSlideComponent slide={slide as CoverSlide} editable={editable} onEdit={handleEdit} />}
        {slide.type === 'content' && <ContentSlideComponent slide={slide as ContentSlide} editable={editable} onEdit={handleEdit} />}
        {slide.type === 'cta' && <CTASlideComponent slide={slide as CTASlide} editable={editable} onEdit={handleEdit} />}
        {/* Slide number indicator */}
        {slide.type === 'content' && totalSlides && index !== undefined && (
          <div style={{
            position: 'absolute',
            bottom: '3%',
            right: '5%',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '2%',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.18)',
            letterSpacing: '0.15em',
          }}>
            {String(index + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
          </div>
        )}
      </div>
    </div>
  );
}