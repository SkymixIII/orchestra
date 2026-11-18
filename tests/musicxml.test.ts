import { readFileSync } from 'node:fs';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseMusicXml, unzipMxl } from '../src/lib/musicxml';

const demo = readFileSync(path.resolve(__dirname, '../public/demo.musicxml'), 'utf8');

const small = `<?xml version="1.0"?>
<score-partwise version="3.1">
  <movement-title>Petit test</movement-title>
  <part-list>
    <score-part id="P1"><part-name>Violon</part-name></score-part>
    <score-part id="P2"><part-name>Cor</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="0" implicit="yes">
      <attributes><divisions>4</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
      <direction><direction-type><metronome><beat-unit>half</beat-unit><beat-unit-dot/><per-minute>40</per-minute></metronome></direction-type></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
    <measure number="1">
      <direction><direction-type><rehearsal>A</rehearsal></direction-type></direction>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>12</duration></note>
    </measure>
    <measure number="2"><note><rest/><duration>12</duration></note></measure>
  </part>
  <part id="P2">
    <measure number="0" implicit="yes"><attributes><divisions>1</divisions></attributes><note><rest/><duration>1</duration></note></measure>
    <measure number="1"><note><rest/><duration>3</duration></note></measure>
    <measure number="2">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration></note>
      <note><cue/><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;

describe('parseMusicXml', () => {
  it('lit instruments, mesures, levée, tempo, repères et activité', () => {
    const s = parseMusicXml(small);
    expect(s.title).toBe('Petit test');
    expect(s.parts.map((p) => p.name)).toEqual(['Violon', 'Cor']);
    expect(s.measures.map((m) => m.label)).toEqual(['0', '1', '2']);
    // Levée d'une noire, puis mesures à 3/4.
    expect(s.measures.map((m) => m.quarters)).toEqual([1, 3, 3]);
    expect(s.measures.map((m) => m.startQuarter)).toEqual([0, 1, 4]);
    // Blanche pointée = 40 → 120 noires/min.
    expect(s.measures[0].tempo).toBe(120);
    expect(s.measures[1].rehearsal).toBe('A');
    expect(s.activity.P1).toEqual([true, true, false]);
    expect(s.activity.P2).toEqual([false, false, true]);
  });

  it('lit la partition de démonstration', () => {
    const s = parseMusicXml(demo);
    expect(s.title).toBe('Ouverture de démonstration');
    expect(s.parts).toHaveLength(11);
    expect(s.measures).toHaveLength(48);
    expect(s.measures[32].time).toBe('3/4');
    expect(s.measures[32].quarters).toBe(3);
    expect(s.measures[24].tempo).toBe(120);
    expect(s.measures[8].rehearsal).toBe('A');
    expect(s.activity.P1[8]).toBe(true);
    expect(s.activity.P1[0]).toBe(false);
  });

  it('refuse un fichier qui n’est pas du MusicXML', () => {
    expect(() => parseMusicXml('<html></html>')).toThrow(/MusicXML/);
    expect(() => parseMusicXml('pas du xml <')).toThrow();
  });

  it('accepte une partition timewise', () => {
    const tw = `<score-timewise><part-list><score-part id="A"><part-name>Harpe</part-name></score-part></part-list>
      <measure number="1"><part id="A"><attributes><divisions>1</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note></part></measure>
      <measure number="2"><part id="A"><note><rest/><duration>4</duration></note></part></measure></score-timewise>`;
    const s = parseMusicXml(tw);
    expect(s.activity.A).toEqual([true, false]);
    expect(s.measures.map((m) => m.label)).toEqual(['1', '2']);
  });
});

describe('durée des mesures', () => {
  it('suit le chiffrage même si les durées des notes sont fausses (OCR)', () => {
    const n = (d: number) => `<note><pitch><step>C</step><octave>4</octave></pitch><duration>${d}</duration></note>`;
    const xml = `<score-partwise><part-list><score-part id="A"><part-name>Cor</part-name></score-part></part-list><part id="A">
      <measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${n(4)}</measure>
      <measure number="2">${n(4)}${n(2)}</measure>
      <measure number="3">${n(1)}</measure>
      <measure number="4"><attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>${n(5)}</measure>
    </part></score-partwise>`;
    expect(parseMusicXml(xml).measures.map((m) => m.quarters)).toEqual([4, 4, 4, 3]);
  });
});

describe('chiffrage issu de l’OCR', () => {
  it('prend le chiffrage majoritaire et ignore les « implicit » en cours de morceau', () => {
    const n = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>';
    const t = (b: number, bt: number) => `<attributes><divisions>2</divisions><time><beats>${b}</beats><beat-type>${bt}</beat-type></time></attributes>`;
    const part = (id: string, first: string, second: string) =>
      `<part id="${id}"><measure number="1">${first}${n}</measure><measure number="2" implicit="yes">${second}${n}</measure><measure number="3">${n}</measure></part>`;
    const xml = `<score-partwise><part-list>
      <score-part id="A"><part-name>A</part-name></score-part><score-part id="B"><part-name>B</part-name></score-part><score-part id="C"><part-name>C</part-name></score-part>
      </part-list>
      ${part('A', t(3, 8), t(2, 4))}${part('B', t(3, 8), '')}${part('C', t(3, 8), '')}</score-partwise>`;
    const s = parseMusicXml(xml);
    // Mesure 1 : levée d'une croche. Mesure 2 : un seul instrument (mal lu) dit 2/4 → 3/8 retenu.
    expect(s.measures.map((m) => m.time)).toEqual(['3/8', '3/8', '3/8']);
    expect(s.measures.map((m) => m.quarters)).toEqual([0.5, 1.5, 1.5]);
  });
});

describe('solos MusicXML', () => {
  it('suit « Solo » jusqu’à « Tutti » ou un silence', () => {
    const note = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>';
    const rest = '<note><rest/><duration>4</duration></note>';
    const words = (t: string) => `<direction><direction-type><words>${t}</words></direction-type></direction>`;
    const xml = `<score-partwise><part-list><score-part id="H"><part-name>Hautbois</part-name></score-part></part-list><part id="H">
      <measure number="1"><attributes><divisions>1</divisions></attributes>${words('Solo')}${note}</measure>
      <measure number="2">${note}</measure>
      <measure number="3">${words('Tutti')}${note}</measure>
      <measure number="4">${words('solo espressivo')}${note}</measure>
      <measure number="5">${rest}</measure>
      <measure number="6">${note}</measure>
    </part></score-partwise>`;
    expect(parseMusicXml(xml).solo?.H).toEqual([true, true, false, true, false, false]);
  });
});

describe('unzipMxl', () => {
  it('extrait la partition désignée par container.xml', () => {
    const zip = zipSync({
      'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="score/main.xml"/></rootfiles></container>'),
      'score/main.xml': strToU8(small),
    });
    expect(parseMusicXml(unzipMxl(zip)).title).toBe('Petit test');
  });
});
