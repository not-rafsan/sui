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

/* ── Decorative Background — precise match to reference (VLM-measured) ── */
function SlideBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* SOLID WHITE circle — top right, mostly outside canvas, only a crescent peeks in */}
      <div style={{
        position: 'absolute',
        top: '-150px',
        right: '-250px',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        backgroundColor: '#FFFFFF',
      }} />

      {/* SOLID WHITE circle — bottom left, mostly outside canvas, only a crescent peeks in */}
      <div style={{
        position: 'absolute',
        bottom: '-130px',
        left: '-150px',
        width: '280px',
        height: '280px',
        borderRadius: '50%',
        backgroundColor: '#FFFFFF',
      }} />

      {/* Scattered small white dots — top left area */}
      {[
        { x: 55, y: 80 }, { x: 130, y: 155 }, { x: 200, y: 55 },
        { x: 90, y: 235 }, { x: 175, y: 125 }, { x: 250, y: 195 },
        { x: 115, y: 310 }, { x: 210, y: 275 },
      ].map((d, i) => (
        <div key={`tl${i}`} style={{
          position: 'absolute',
          left: `${d.x}px`,
          top: `${d.y}px`,
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          opacity: 0.8,
        }} />
      ))}

      {/* Scattered small white dots — bottom right area */}
      {[
        { x: 850, y: 1020 }, { x: 920, y: 1100 }, { x: 780, y: 1160 },
        { x: 970, y: 1050 }, { x: 890, y: 1180 }, { x: 740, y: 1080 },
        { x: 960, y: 1150 }, { x: 830, y: 1220 }, { x: 700, y: 1260 },
      ].map((d, i) => (
        <div key={`br${i}`} style={{
          position: 'absolute',
          left: `${d.x}px`,
          top: `${d.y}px`,
          width: '4px',
          height: '4px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          opacity: 0.7,
        }} />
      ))}

      {/* A few extra scattered dots — mid edges */}
      {[
        { x: 30, y: 500 }, { x: 960, y: 400 },
        { x: 50, y: 900 }, { x: 1000, y: 700 },
      ].map((d, i) => (
        <div key={`mid${i}`} style={{
          position: 'absolute',
          left: `${d.x}px`,
          top: `${d.y}px`,
          width: '3px',
          height: '3px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          opacity: 0.4,
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
          border: '2px solid rgba(255,255,255,0.4)',
          color: '#fff',
          outline: 'none',
          padding: '8px 16px',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          fontWeight: 'inherit',
          letterSpacing: 'inherit',
          textTransform: 'inherit',
          width: '90%',
          textAlign: (style?.textAlign as 'left' | 'center') || 'left',
          borderRadius: '4px',
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

/* ── COVER SLIDE ── */
function CoverSlideComponent({ slide, editable, onEdit }: { slide: CoverSlide; editable?: boolean; onEdit?: (p: string, v: string) => void }) {
  const titleWords = slide.title.split(' ');
  const emphasisIdx = titleWords.reduce((maxI, w, i, arr) => w.length > arr[maxI].length ? i : maxI, 0);

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '60px 80px', boxSizing: 'border-box', textAlign: 'center',
    }}>
      <SlideBackground />

      {/* Accent tag above title */}
      {slide.accentText && (
        <EditableText
          text={slide.accentText}
          path="accentText"
          editable={editable}
          onEdit={onEdit}
          tag="p"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '22px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.45em',
            textTransform: 'uppercase',
            marginBottom: '24px',
            position: 'relative', zIndex: 1,
          }}
        />
      )}

      {/* Title — multi-line, keyword line BIGGER */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        lineHeight: 1.08,
      }}>
        {/* Words before the keyword */}
        <EditableText
          text={titleWords.slice(0, emphasisIdx).join(' ')}
          path="title"
          editable={editable}
          onEdit={onEdit}
          tag="h1"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '68px',
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            lineHeight: 1.08,
            display: titleWords.slice(0, emphasisIdx).join(' ') ? 'block' : 'none',
          }}
        />
        {/* Keyword — BIGGEST line */}
        <EditableText
          text={titleWords[emphasisIdx] || ''}
          path="title"
          editable={editable}
          onEdit={onEdit}
          tag="h1"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '126px',
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            lineHeight: 1.08,
            display: titleWords[emphasisIdx] ? 'block' : 'none',
          }}
        />
        {/* Words after the keyword */}
        <EditableText
          text={titleWords.slice(emphasisIdx + 1).join(' ')}
          path="title"
          editable={editable}
          onEdit={onEdit}
          tag="h1"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '68px',
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            lineHeight: 1.08,
            display: titleWords.slice(emphasisIdx + 1).join(' ') ? 'block' : 'none',
          }}
        />
      </div>

      {/* White divider */}
      <div style={{
        width: '55%',
        height: '7px',
        backgroundColor: '#FFFFFF',
        margin: '28px 0',
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
          fontSize: '42px',
          fontWeight: 500,
          color: '#FFFFFF',
          letterSpacing: '5px',
          textTransform: 'uppercase',
          lineHeight: 1.2,
          position: 'relative', zIndex: 1,
        }}
      />
    </div>
  );
}

/* ── CONTENT SLIDE ── */
function ContentSlideComponent({ slide, editable, onEdit }: { slide: ContentSlide; editable?: boolean; onEdit?: (p: string, v: string) => void }) {
  const bullets = Array.isArray(slide.bulletPoints) ? slide.bulletPoints : [];

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      padding: '70px 100px', boxSizing: 'border-box',
    }}>
      <SlideBackground />

      {/* CHAPTER XX — large, centered, bold */}
      <div style={{
        textAlign: 'center',
        position: 'relative', zIndex: 1,
        marginBottom: '14px',
      }}>
        <EditableText
          text={`CHAPTER ${String(slide.chapterNumber).padStart(2, '0')}`}
          path="chapterNumber"
          editable={editable}
          onEdit={onEdit}
          tag="h2"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '124px',
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '5px',
            lineHeight: 1.05,
            textTransform: 'uppercase',
          }}
        />
      </div>

      {/* Thick underline below chapter */}
      <div style={{
        width: '55%',
        height: '18px',
        backgroundColor: '#FFFFFF',
        marginBottom: '44px',
        position: 'relative', zIndex: 1,
      }} />

      {/* Bullet points with white filled circle markers */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        gap: '28px',
        width: '100%',
        position: 'relative', zIndex: 1,
        flex: 1,
        justifyContent: 'flex-start',
      }}>
        {bullets.map((point: string, i: number) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '22px',
          }}>
            {/* White filled circle bullet marker */}
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              flexShrink: 0,
            }} />
            <EditableText
              text={typeof point === 'string' ? point : String(point)}
              path={`bulletPoints.${i}`}
              editable={editable}
              onEdit={onEdit}
              tag="div"
              style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: '40px',
                fontWeight: 400,
                color: '#FFFFFF',
                lineHeight: 1.4,
                letterSpacing: '1px',
                flex: 1,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── CTA SLIDE ── */
function CTASlideComponent({ slide, editable, onEdit }: { slide: CTASlide; editable?: boolean; onEdit?: (p: string, v: string) => void }) {
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '60px 80px', boxSizing: 'border-box', textAlign: 'center',
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
          fontSize: '118px',
          fontWeight: 700,
          color: '#FFFFFF',
          letterSpacing: '8px',
          textTransform: 'uppercase',
          lineHeight: 1.1,
          position: 'relative', zIndex: 1,
          width: '100%',
        }}
      />

      {/* Thick white divider */}
      <div style={{
        width: '50%',
        height: '16px',
        backgroundColor: '#FFFFFF',
        margin: '32px 0',
        position: 'relative', zIndex: 1,
      }} />

      {/* Follow/subtitle text */}
      <EditableText
        text={slide.subtitle}
        path="subtitle"
        editable={editable}
        onEdit={onEdit}
        tag="p"
        style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: '38px',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.6)',
          letterSpacing: '6px',
          textTransform: 'uppercase',
          lineHeight: 1.3,
          position: 'relative', zIndex: 1,
        }}
      />

      {/* Optional accent text */}
      {slide.accentText && (
        <EditableText
          text={slide.accentText}
          path="accentText"
          editable={editable}
          onEdit={onEdit}
          tag="p"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '22px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            marginTop: '32px',
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
            bottom: '24px',
            right: '40px',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '18px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.2)',
            letterSpacing: '4px',
            zIndex: 1,
          }}>
            {String(index + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
          </div>
        )}
      </div>
    </div>
  );
}