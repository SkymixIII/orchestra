"""Génère public/demo.musicxml : une petite pièce d'exemple pour essayer l'appli."""
import os

parts = [("P1","Flûtes","Fl."),("P2","Hautbois","Hb."),("P3","Clarinettes","Cl."),("P4","Cors","Cor"),
         ("P5","Trompettes","Tp."),("P6","Timbales","Timb."),("P7","Violons I","Vl. I"),("P8","Violons II","Vl. II"),
         ("P9","Altos","Alt."),("P10","Violoncelles","Vc."),("P11","Contrebasses","Cb.")]
N = 48
# mesures (1-based) où chaque part joue
def r(a,b): return set(range(a,b+1))
plays = {
 "P1": r(9,16)|r(33,40), "P2": r(13,20)|r(37,44), "P3": r(17,24)|r(41,48),
 "P4": r(21,28)|r(45,48), "P5": r(25,28)|r(45,48), "P6": {28,44,45,46,47,48},
 "P7": r(1,12)|r(25,48), "P8": r(1,12)|r(25,48), "P9": r(5,16)|r(29,48),
 "P10": r(1,8)|r(17,48), "P11": r(1,8)|r(21,48),
}
rehearsal = {9:"A",17:"B",25:"C",33:"D",41:"E"}
tempo = {1:96, 25:120, 41:84}
out = ['<?xml version="1.0" encoding="UTF-8"?>',
 '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
 '<score-partwise version="4.0">','<work><work-title>Ouverture de démonstration</work-title></work>','<part-list>']
for pid,name,abbr in parts:
    out.append(f'<score-part id="{pid}"><part-name>{name}</part-name><part-abbreviation>{abbr}</part-abbreviation></score-part>')
out.append('</part-list>')
for pi,(pid,_,_) in enumerate(parts):
    out.append(f'<part id="{pid}">')
    for m in range(1,N+1):
        out.append(f'<measure number="{m}">')
        if m == 1:
            out.append('<attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>')
        if m == 33:
            out.append('<attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>')
        if pi == 0 and m in rehearsal:
            out.append(f'<direction placement="above"><direction-type><rehearsal>{rehearsal[m]}</rehearsal></direction-type></direction>')
        if pi == 0 and m in tempo:
            out.append(f'<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>{tempo[m]}</per-minute></metronome></direction-type><sound tempo="{tempo[m]}"/></direction>')
        beats = 3 if m >= 33 else 4
        if m in plays[pid]:
            for _ in range(beats):
                out.append('<note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>')
        else:
            out.append(f'<note><rest measure="yes"/><duration>{beats*2}</duration></note>')
        out.append('</measure>')
    out.append('</part>')
out.append('</score-partwise>')
here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, '..', 'public', 'demo.musicxml'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(out) + '\n')
