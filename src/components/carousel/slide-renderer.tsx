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

/* ── Decorative Background ── */
function DecorativeBackground({ variant }: { variant: 'cover' | 'content' | 'cta' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Large circle top-right */}
      <div
        style={{
          position: 'absolute',
          top: variant === 'cover' ? '-18%' : '-12%',
          right: variant === 'cover' ? '-14%' : '-10%',
          width: variant === 'cover' ? '52%' : '38%',
          height: variant === 'cover' ? '52%' : '38%',
          borderRadius: '50%',
          border: '1.5px solid rgba(255,255,255,0.12)',
        }}
      />
      {/* Large circle bottom-left */}
      <div
        style={{
          position: 'absolute',
          bottom: '-16%',
          left: '-12%',
          width: '46%',
          height: '46%',
          borderRadius: '50%',
          border: '1.5px solid rgba(255,255,255,0.08)',
        }}
      />
      {/* Small dots scattered - top left cluster */}
      {[
        { top: '8%', left: '6%', size: 3, opacity: 0.25 },
        { top: '12%', left: '14%', size: 2, opacity: 0.15 },
        { top: '6%', left: '18%', size: 2.5, opacity: 0.2 },
        { top: '15%', left: '8%', size: 1.5, opacity: 0.12 },
        { top: '10%', left: '24%', size: 2, opacity: 0.18 },
      ].map((dot, i) => (
        <div
          key={`tl-${i}`}
          style={{
            position: 'absolute',
            top: dot.top,
            left: dot.left,
            width: dot.size,
            height: dot.size,
            borderRadius: '50%',
            backgroundColor: `rgba(255,255,255,${dot.opacity})`,
          }}
        />
      ))}
      {/* Small dots scattered - bottom right cluster */}
      {[
        { bottom: '10%', right: '8%', size: 2.5, opacity: 0.2 },
        { bottom: '14%', right: '16%', size: 2, opacity: 0.15 },
        { bottom: '8%', right: '20%', size: 3, opacity: 0.22 },
        { bottom: '18%', right: '6%', size: 1.5, opacity: 0.12 },
        { bottom: '12%', right: '24%', size: 2, opacity: 0.16 },
      ].map((dot, i) => (
        <div
          key={`br-${i}`}
          style={{
            position: 'absolute',
            bottom: dot.bottom,
            right: dot.right,
            width: dot.size,
            height: dot.size,
            borderRadius: '50%',
            backgroundColor: `rgba(255,255,255,${dot.opacity})`,
          }}
        />
      ))}
      {/* Subtle grid lines for content slides */}
      {variant === 'content' && (
        <>
          <div style={{ position: 'absolute', top: 0, left: '8%', width: '1px', height: '100%', backgroundColor: 'rgba(255,255,255,0.03)' }} />
          <div style={{ position: 'absolute', top: 0, right: '8%', width: '1px', height: '100%', backgroundColor: 'rgba(255,255,255,0.03)' }} />
        </>
      )}
    </div>
  );
}

/* ── Editable Text ── */
function EditableText({
  text,
  path,
  editable,
  onEdit,
  style,
  tag: Tag = 'div',
  className = '',
}: {
  text: string;
  path: string;
  editable?: boolean;
  onEdit?: (path: string, value: string) => void;
  style?: React.CSSProperties;
  tag?: 'div' | 'span' | 'p' | 'h1' | 'h2';
  className?: string;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [localValue, setLocalValue] = React.useState(text);

  React.useEffect(() => {
    setLocalValue(text);
  }, [text]);

  if (editable && onEdit) {
    if (isEditing) {
      return (
        <input
          autoFocus
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => {
            onEdit(path, localValue);
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onEdit(path, localValue);
              setIsEditing(false);
            }
          }}
          className={className}
          style={{
            ...style,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white',
            outline: 'none',
            padding: '2px 8px',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            letterSpacing: 'inherit',
            textTransform: 'inherit',
            width: '90%',
            textAlign: (style?.textAlign as 'left' | 'center') || 'left',
          }}
        />
      );
    }
    return (
      <Tag
        className={className}
        style={{ ...style, cursor: 'text' }}
        onClick={() => setIsEditing(true)}
        title="Click to edit"
      >
        {text}
      </Tag>
    );
  }

  return (
    <Tag className={className} style={style}>
      {text}
    </Tag>
  );
}

/* ── Cover Slide ── */
function CoverSlideComponent({ slide, editable, onEdit }: { slide: CoverSlide; editable?: boolean; onEdit?: (p: string, v: string) => void }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', padding: '10%', boxSizing: 'border-box' }}>
      <DecorativeBackground variant="cover" />
      {/* Accent line top */}
      <div style={{ width: '60px', height: '3px', backgroundColor: '#ffffff', marginBottom: '5%', position: 'relative', zIndex: 1 }} />
      {/* Subtitle / tagline */}
      {slide.accentText && (
        <EditableText
          text={slide.accentText}
          path="accentText"
          editable={editable}
          onEdit={onEdit}
          tag="p"
          style={{
            fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
            fontSize: '3.5%',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            marginBottom: '3%',
            position: 'relative',
            zIndex: 1,
          }}
        />
      )}
      {/* Main title */}
      <EditableText
        text={slide.title}
        path="title"
        editable={editable}
        onEdit={onEdit}
        tag="h1"
        style={{
          fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
          fontSize: '10%',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          textTransform: 'uppercase',
          position: 'relative',
          zIndex: 1,
          maxWidth: '85%',
        }}
      />
      {/* Divider line */}
      <div style={{ width: '40%', height: '1px', backgroundColor: 'rgba(255,255,255,0.2)', margin: '4% 0', position: 'relative', zIndex: 1 }} />
      {/* Subtitle */}
      <EditableText
        text={slide.subtitle}
        path="subtitle"
        editable={editable}
        onEdit={onEdit}
        tag="p"
        style={{
          fontFamily: '"Inter", "Space Grotesk", system-ui, sans-serif',
          fontSize: '4%',
          fontWeight: 300,
          color: 'rgba(255,255,255,0.6)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          position: 'relative',
          zIndex: 1,
        }}
      />
    </div>
  );
}

/* ── Content Slide ── */
function ContentSlideComponent({ slide, editable, onEdit }: { slide: ContentSlide; editable?: boolean; onEdit?: (p: string, v: string) => void }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10%', boxSizing: 'border-box' }}>
      <DecorativeBackground variant="content" />
      {/* Chapter label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3%', marginBottom: '4%', position: 'relative', zIndex: 1 }}>
        <span
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '3%',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.5em',
            textTransform: 'uppercase',
          }}
        >
          CHAPTER
        </span>
        <EditableText
          text={String(slide.chapterNumber).padStart(2, '0')}
          path="chapterNumber"
          editable={editable}
          onEdit={onEdit}
          tag="span"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '4.5%',
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '0.1em',
          }}
        />
      </div>
      {/* Title */}
      <EditableText
        text={slide.title}
        path="title"
        editable={editable}
        onEdit={onEdit}
        tag="h2"
        style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: '7.5%',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '-0.01em',
          lineHeight: 1.15,
          textTransform: 'uppercase',
          marginBottom: '2%',
          position: 'relative',
          zIndex: 1,
        }}
      />
      {/* Subtitle */}
      {slide.subtitle && (
        <EditableText
          text={slide.subtitle}
          path="subtitle"
          editable={editable}
          onEdit={onEdit}
          tag="p"
          style={{
            fontFamily: '"Inter", system-ui, sans-serif',
            fontSize: '3.2%',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.04em',
            marginBottom: '5%',
            position: 'relative',
            zIndex: 1,
          }}
        />
      )}
      {/* Divider */}
      <div style={{ width: '15%', height: '1.5px', backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: '4%', position: 'relative', zIndex: 1 }} />
      {/* Bullet points */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.8%', position: 'relative', zIndex: 1, flex: 1, justifyContent: 'center' }}>
        {Array.isArray(slide.bulletPoints) ? slide.bulletPoints.map((point: string, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '2.5%' }}>
            <EditableText
              text={typeof point === 'string' ? point : String(point)}
              path={`bulletPoints.${i}`}
              editable={editable}
              onEdit={onEdit}
              tag="div"
              style={{
                fontFamily: '"Inter", system-ui, sans-serif',
                fontSize: '3.5%',
                fontWeight: 400,
                color: 'rgba(255,255,255,0.8)',
                lineHeight: 1.4,
                letterSpacing: '0.01em',
                flex: 1,
              }}
            />
            <span style={{ color: '#ffffff', fontWeight: 700, flexShrink: 0, marginTop: '-0.2em', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '3.5%', lineHeight: 1.4 }}>—</span>
          </div>
        )) : null}
      </div>
      {/* Earning potential badge */}
      {slide.earningPotential && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2%',
            marginTop: '4%',
            padding: '2% 4%',
            border: '1px solid rgba(255,255,255,0.15)',
            alignSelf: 'flex-start',
          }}
        >
          <EditableText
            text={slide.earningPotential}
            path="earningPotential"
            editable={editable}
            onEdit={onEdit}
            tag="span"
            style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: '3.2%',
              fontWeight: 600,
              color: '#ffffff',
              letterSpacing: '0.08em',
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ── CTA Slide ── */
function CTASlideComponent({ slide, editable, onEdit }: { slide: CTASlide; editable?: boolean; onEdit?: (p: string, v: string) => void }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '10%', boxSizing: 'border-box', textAlign: 'center' }}>
      <DecorativeBackground variant="cta" />
      {/* Main CTA */}
      <EditableText
        text={slide.title}
        path="title"
        editable={editable}
        onEdit={onEdit}
        tag="h1"
        style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: '11%',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          lineHeight: 1.1,
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          width: '100%',
        }}
      />
      {/* Divider */}
      <div style={{ width: '30%', height: '1px', backgroundColor: 'rgba(255,255,255,0.25)', margin: '5% 0', position: 'relative', zIndex: 1 }} />
      {/* Follow text */}
      <EditableText
        text={slide.subtitle}
        path="subtitle"
        editable={editable}
        onEdit={onEdit}
        tag="p"
        style={{
          fontFamily: '"Inter", system-ui, sans-serif',
          fontSize: '3.8%',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
        }}
      />
      {/* Accent tag */}
      {slide.accentText && (
        <EditableText
          text={slide.accentText}
          path="accentText"
          editable={editable}
          onEdit={onEdit}
          tag="p"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '2.5%',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            marginTop: '6%',
            position: 'relative',
            zIndex: 1,
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
    boxShadow: scale < 1 ? '0 4px 20px rgba(0,0,0,0.5)' : 'none',
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
        {/* Page indicator for non-cover/cta slides */}
        {slide.type === 'content' && totalSlides && index !== undefined && (
          <div
            style={{
              position: 'absolute',
              bottom: '3%',
              right: '6%',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: '2%',
              fontWeight: 400,
              color: 'rgba(255,255,255,0.2)',
              letterSpacing: '0.2em',
            }}
          >
            {String(index + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
          </div>
        )}
      </div>
    </div>
  );
}