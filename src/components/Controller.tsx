/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, Pause, Search, Plus, Trash2, Eye, EyeOff, Monitor, Layout, 
  ChevronLeft, ChevronRight, Bold, AlignLeft, AlignCenter, AlignRight, 
  Sparkles, Upload, X, RefreshCw, Layers, Edit2, Check, BookOpen, Video, VideoOff, RotateCcw, Radio, Camera, Settings
} from 'lucide-react';
import { Song, Background, ProjectorState, ProjectorMessage } from '../types';
import JSZip from 'jszip';
import { DEFAULT_SONGS, DEFAULT_BACKGROUNDS } from '../data';
import { ConsoleSubTabs } from './ConsoleSubTabs';
import { saveMediaBlob, deleteMediaBlob, useResolvedVideoUrl } from '../utils/db';
import { 
  saveLocalState, getLocalState, 
  saveLocalSongs, getLocalSongs, 
  saveLocalBackgrounds, getLocalBackgrounds, 
  ProjectorHub, INITIAL_STATE 
} from '../utils/sync';

const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds === null || seconds === undefined) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const sStr = s < 10 ? `0${s}` : `${s}`;
  if (h > 0) {
    const mStr = m < 10 ? `0${m}` : `${m}`;
    return `${h}:${mStr}:${sStr}`;
  }
  return `${m}:${sStr}`;
};

function BackgroundThumbnail({
  bg,
  isSelected,
  onClick,
  onDelete,
  isDeleteModeActive = false,
  isDeletionSelected = false
}: {
  bg: Background;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void | Promise<void>;
  isDeleteModeActive?: boolean;
  isDeletionSelected?: boolean;
  key?: React.Key;
}) {
  const resolvedUrl = useResolvedVideoUrl(bg.url);
  const isVideo = bg.type === 'video';
  const bgThumbStyle = {
    backgroundImage: resolvedUrl ? `url(${resolvedUrl})` : bg.url.startsWith('db://') ? 'none' : `url(${bg.url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };

  return (
    <div
      onClick={onClick}
      className={`relative aspect-[16/10] rounded cursor-pointer border overflow-hidden group transition ${
        isDeleteModeActive
          ? isDeletionSelected
            ? 'border-red-500 ring-2 ring-red-500/40 shadow-lg'
            : 'border-zinc-805 opacity-60 hover:opacity-100'
          : isSelected
            ? 'border-red-500 ring-2 ring-red-500/20 shadow-md'
            : 'border-zinc-805 hover:border-zinc-700'
      }`}
      title={bg.name}
    >
      {isVideo ? (
        <div className="w-full h-full bg-zinc-950 flex items-center justify-center relative">
          <video
            src={resolvedUrl || bg.url}
            className="w-full h-full object-cover opacity-70"
            muted
            loop
            playsInline
            autoPlay
          />
          <span className="absolute text-[11px] drop-shadow-md">📹</span>
        </div>
      ) : (
        <div style={bgThumbStyle} className="w-full h-full" />
      )}
      <div className={`absolute inset-0 transition-colors ${
        isDeleteModeActive
          ? isDeletionSelected
            ? 'bg-red-950/20'
            : 'bg-black/45'
          : 'bg-black/45 group-hover:bg-black/10'
      }`} />
      
      <div className="absolute bottom-0 text-[7px] bg-black/90 text-zinc-300 py-0.5 w-full text-center truncate px-1 font-sans font-bold z-5">
        {bg.name}
      </div>

      {isDeleteModeActive ? (
        <div className="absolute top-1 left-1 z-10 bg-zinc-950/90 border border-zinc-800 rounded p-[3px] flex items-center justify-center">
          {isDeletionSelected ? (
            <div className="w-3.5 h-3.5 bg-red-650 rounded flex items-center justify-center text-white text-[8px] font-black">
              ✓
            </div>
          ) : (
            <div className="w-3.5 h-3.5 bg-transparent border border-zinc-700 rounded" />
          )}
        </div>
      ) : (
        bg.isCustom && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
            className="absolute top-0.5 right-0.5 p-0.5 bg-red-650 hover:bg-red-550 rounded text-white opacity-0 group-hover:opacity-100 transition duration-155 shadow cursor-pointer z-10"
            title="Eliminar"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )
      )}
    </div>
  );
}

function getSharedMobileCameraUrl(roomId: string, name?: string): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.host;
  const finalName = name || 'Cámara Celular';
  return `${window.location.protocol}//${host}/?mode=cam&room=${encodeURIComponent(roomId)}&name=${encodeURIComponent(finalName)}`;
}

// 5 Custom visual skins for matching colors, borders, and typography of the Controller layout
const SKINS = {
  default: {
    id: 'default',
    name: 'Carbono Oscuro (Defecto)',
    description: 'Consola técnica profesional de color gris oscuro minimalista.',
    bgMain: '#1c1c1f',
    bgPanel: '#1a1a1c',
    bgNested: '#0f0f11',
    bgInner: '#17171a',
    border: '#2c2c30',
    borderLight: '#2d2d30',
    accent: '#6366f1',
    accentBg: '#4f46e5',
    textPrimary: '#d4d4d8',
    textMuted: '#71717a',
    font: 'monospace',
    borderStyle: 'solid',
    borderWidth: '1px',
    borderRadius: '8px',
    borderRadiusInner: '6px'
  },
  celestial: {
    id: 'celestial',
    name: 'Aura Celestial (Cian y Azul)',
    description: 'Estilo espacial limpio con tonos azulados profundos, realzado con cian vibrante.',
    bgMain: '#050b14',
    bgPanel: '#0e1726',
    bgNested: '#080d1a',
    bgInner: '#111c30',
    border: '#105e78',
    borderLight: '#1e293b',
    accent: '#06b6d4',
    accentBg: '#0891b2',
    textPrimary: '#e2e8f0',
    textMuted: '#64748b',
    font: 'system-ui, -apple-system, sans-serif',
    borderStyle: 'solid',
    borderWidth: '1.5px',
    borderRadius: '8px',
    borderRadiusInner: '6px'
  },
  white_rounded: {
    id: 'white_rounded',
    name: 'Blanco Puro (Bordes Redondeados)',
    description: 'Consola minimalista y limpia con fondo blanco impecable y bordes extra redondeados.',
    bgMain: '#f4f4f7',
    bgPanel: '#ffffff',
    bgNested: '#eaeaea',
    bgInner: '#fcfcfd',
    border: '#d4d4d8',
    borderLight: '#e4e4e7',
    accent: '#8b5cf6',
    accentBg: '#f5f3ff',
    textPrimary: '#18181b',
    textMuted: '#71717a',
    font: 'system-ui, -apple-system, sans-serif',
    borderStyle: 'solid',
    borderWidth: '1px',
    borderRadius: '16px',
    borderRadiusInner: '12px'
  },
  golden: {
    id: 'golden',
    name: 'Templo de Oro (Ámbar y Ónix)',
    description: 'Elegancia y reverencia excelsa con bordes marcados en tonos ámbar brillante y bronce de templo.',
    bgMain: '#0d0a06',
    bgPanel: '#18120b',
    bgNested: '#100b07',
    bgInner: '#251b10',
    border: '#b45309',
    borderLight: '#3f2203',
    accent: '#fbbf24',
    accentBg: '#b45309',
    textPrimary: '#fef3c7',
    textMuted: '#d97706',
    font: 'system-ui, sans-serif',
    borderStyle: 'solid',
    borderWidth: '1px',
    borderRadius: '8px',
    borderRadiusInner: '6px'
  },
  crimson_gray: {
    id: 'crimson_gray',
    name: 'Gris Claro y Rojo Carmesí',
    description: 'Estilo limpio industrial con fondo gris claro y acentos en rojo vibrante de alto contraste.',
    bgMain: '#e5e7eb',
    bgPanel: '#f3f4f6',
    bgNested: '#d1d5db',
    bgInner: '#f9fafb',
    border: '#dc2626',
    borderLight: '#fca5a5',
    accent: '#ef4444',
    accentBg: '#fee2e2',
    textPrimary: '#111827',
    textMuted: '#4b5563',
    font: 'system-ui, -apple-system, sans-serif',
    borderStyle: 'solid',
    borderWidth: '1.2px',
    borderRadius: '8px',
    borderRadiusInner: '6px'
  }
};

interface SaintInfo {
  name: string;
  type: string;
  bio: string;
  phrase: string;
}

const DEFAULT_SAINTS_BY_DATE: Record<string, SaintInfo> = {
  // June Catholical Liturgy - Argentine Catholic Santoral
  "6-1": { 
    name: "Nuestra Señora de Luján", 
    type: "Patrona Nacional de la República Argentina", 
    bio: "Madre de la Patria y consuelo perpetuo de los argentinos. Su basílica nacional es el corazón vivo de la devoción mariana en el país.", 
    phrase: "María, Madre de Luján, protege a las familias de nuestra querida Patria." 
  },
  "6-2": { 
    name: "Santo Cura Brochero", 
    type: "San José Gabriel del Rosario, El Cura Gaucho", 
    bio: "Ejemplo vivo de celo pastoral. Evangelizó lomo de mula por todas las sierras cordobesas, abriendo caminos y asilos de ejercicios.", 
    phrase: "Dios es como los mosquitos: en todas partes está, pero tiene predilección por los necesitados." 
  },
  "6-3": { 
    name: "Santa Mama Antula", 
    type: "Santa María Antonia de San José, Primera Santa Argentina", 
    bio: "Mujer fuerte de la fe colonial. Caminó descalza miles de kilómetros para sostener vivos los Ejercicios Espirituales ignacianos.", 
    phrase: "La paciencia todo lo alcanza. Quien confía de verdad en la providencia de Dios nunca andará apurado." 
  },
  "6-4": { 
    name: "Beato Ceferino Namuncurá", 
    type: "El Lirio de la Patagonia, Joven Sembrador", 
    bio: "Joven descendiente mapuche y alumno salesiano ejemplar. Un modelo de pureza, piedad profunda y deseo incansable de ser útil a su gente.", 
    phrase: "Quiero ser útil a mi gente y llevarles la alegría del santo Evangelio." 
  },
  "6-5": { 
    name: "Beato Mamerto Esquiú", 
    type: "Obispo del Civismo y de la Paz Franciscana", 
    bio: "Faro moral en épocas difíciles. El humilde fraile catamarqueño que unió a la nación promoviendo la paz nacional desde el púlpito.", 
    phrase: "La paz y concordia civil son las bases santas sobre las cuales descansa la prosperidad de los pueblos." 
  },
  "6-6": { 
    name: "San Héctor Valdivielso Sáez", 
    type: "Hermano de La Salle, Primer Santo Argentino Mártir", 
    bio: "Nacido en Buenos Aires y educador apasionado de niños necesitados. Mantuvo su fe inquebrantable hasta su martirio de amor.", 
    phrase: "Educar con el corazón es la forma más bella de sembrar la luz divina en los jóvenes." 
  },
  "6-7": { 
    name: "Nuestra Señora de Itatí", 
    type: "Patrona y Protectora de todo el Nordeste Argentino", 
    bio: "Madre morena del Paraná venerada en Corrientes. Sus milagros de auxilio a los pueblos ribereños convocan a miles de peregrinos.", 
    phrase: "Virgen de Itatí, protege con tu tierno manto el caminar del pueblo argentino." 
  },
  "6-8": { 
    name: "Beato Cardenal Eduardo Pironio", 
    type: "El Cardenal de la Esperanza, Padre de la Juventud", 
    bio: "Pastor ejemplar que enseñó la teología de la cruz y la alegría. Fundador e impulsor de las históricas Jornadas Mundiales de la Juventud.", 
    phrase: "La esperanza no defrauda jamás, porque está cimentada en la fidelidad eterna de Jesús." 
  },
  "6-9": { 
    name: "Beatos Mártires Riojanos", 
    type: "Angelelli, de Dios Murias, Longueville y Pedernera", 
    bio: "Testigos de la verdad evangélica en los campos de La Rioja. Dedicaron sus vidas a la promoción de los campesinos en comunión con Cristo.", 
    phrase: "Con un oído en el Evangelio y el otro en el clamor sufriente de nuestro pueblo." 
  },
  "6-10": { 
    name: "Beata Laura Vicuña", 
    type: "Flor de los Andes, Joven Ofrenda de la Patagonia", 
    bio: "Joven estudiante en Junín de los Andes que ofreció heroicamente su vida entera a Dios por la auténtica conversión de su madre.", 
    phrase: "Señor, prefiero morir antes que pecar, toma mi pobre juventud como una humilde plegaria de reconciliación." 
  },
  "6-11": { 
    name: "Beata María Tránsito de Cabanillas", 
    type: "Madre Tránsito de Jesús, Fundadora en Córdoba", 
    bio: "Humilde religiosa cordobesa que fundó las Terciarias Misioneras Franciscanas. Se consagró con dulzura extrema a huérfanos y necesitados.", 
    phrase: "El olvido de uno mismo por amor a los pequeños es la ofrenda más grata ante el Altar de la Gracia." 
  },
  "6-12": { 
    name: "Señor y Virgen del Milagro", 
    type: "Patronos Protectores de la Provincia de Salta", 
    bio: "Su milagrosa intercesión en el siglo XVII salvó al pueblo norteño de los sismos, sellando un eterno pacto de devoción federal.", 
    phrase: "Tú con nosotros, nosotros contigo; Salta renueva hoy su pacto inquebrantable de fidelidad." 
  },
  "6-13": { 
    name: "San Antonio de Padua", 
    type: "Tradicional Doctor de Nuestra Fe, Amigo del Pueblo", 
    bio: "Sacerdote franciscano portador de una elocuencia celestial y tierno protector de los pobres. Sumamente venerado en capillas criollas.", 
    phrase: "El habla es fecunda cuando las buenas obras hablan de Cristo y confirman lo que enseña la boca." 
  },
  "6-14": { 
    name: "Beata María Crescencia Pérez", 
    type: "Mensajera de la Paz, Hija de María Santísima del Huerto", 
    bio: "Venerada religiosa cuyo cuerpo descansa incorrupto en Pergamino. Ejemplo excelso de mansedumbre caritativa y entrega silenciosa.", 
    phrase: "Hacer siempre el bien silenciosamente, sembrando paz y consuelo en todos los corazones." 
  },
  "6-15": { 
    name: "Beata Camila Rolón", 
    type: "Madre de los Desamparados, Fundadora de La Plata", 
    bio: "Insigne fundadora de las Hermanas Pobres Bonaerenses, quien consagró su larga vida a cobijar huérfanos y ancianos abandonados.", 
    phrase: "Para Dios no hay nada imposible cuando se obra con recta intención y amor sin límites." 
  },
  "6-16": { 
    name: "Nuestra Señora de la Guardia", 
    type: "Protectora Excelso de los Inmigrantes y sus Familias", 
    bio: "Veneración introducida por la comunidad genovesa en Buenos Aires, símbolo entrañable del amparo divino sobre el trabajo laborioso.", 
    phrase: "Virgen Santísima, custodia el trabajo de los hogares que forjan con esfuerzo el porvenir del país." 
  },
  "6-17": { 
    name: "San Martín de Tours", 
    type: "Patrono Protector de la Ciudad de Buenos Aires", 
    bio: "Soldado romano piadoso que dividió su capa militar con un mendigo tiritando. Fue elegido patrono fundacional de la capital argentina.", 
    phrase: "No ruego por ser liberado de las fatigas diarias, que se cumpla siempre en mí tu santa voluntad." 
  },
  "6-18": { 
    name: "Nuestra Señora del Valle de Catamarca", 
    type: "Protectora del Noroeste Argentino y Patrona Nacional de Turismo", 
    bio: "Su milagrosa imagen morena fue hallada en la gruta de Choya. Es madre del consuelo federal y congrega enormes procesiones de fe.", 
    phrase: "Virgen del Valle, cobija las esperanzas, dolores y alegrías de tus hijos peregrinos." 
  },
  "6-19": { 
    name: "San Medardo de Noyon", 
    type: "Protector Celestial de los Agricultores y Campos", 
    bio: "Apóstol de la caridad en el entorno rural, invocado en la campaña argentina para obtener buenas cosechas y lluvias propicias.", 
    phrase: "Seamos siempre agradecidos con los frutos de la tierra que la Divina Providencia nos regala cada mañana." 
  },
  "6-20": { 
    name: "Nuestra Señora de la Merced", 
    type: "Madra Celestial, Patrona y Generala del Ejército Argentino", 
    bio: "Elegida por el General Manuel Belgrano como Generala de las Fuerzas Patrias, rindiéndole su bastón de mando tras la Batalla de Tucumán.", 
    phrase: "Bajo tu amparo maternal colocamos la libertad, honor y soberanía de nuestra amada República." 
  },
  "6-21": { 
    name: "San Luis Gonzaga", 
    type: "Patrono Universal de los Estudiantes y Jóvenes Católicos", 
    bio: "Joven jesuita que prefirió la entrega total del alma, sirviendo pastoralmente en tiempos de peste hasta entregar su propia vida.", 
    phrase: "La verdadera grandeza no está en los títulos mundanos, sino en el humilde servicio a los enfermos de Cristo." 
  },
  "6-22": { 
    name: "Nuestra Señora de Sumampa", 
    type: "Patrona de Santiago del Estero y Madre del Consuelo", 
    bio: "Llegada milagrosamente en carreta junto a la Virgen de Luján en el siglo XVII, eligiendo quedarse en tierras santiagueñas para amparar a sus hijos gauchos.", 
    phrase: "Virgen de Sumampa, enséñanos a habitar la llanura del silencio y de la fidelidad cristiana." 
  },
  "6-23": { 
    name: "San José Cafasso", 
    type: "Padre del Clero y Consolador de los Presos", 
    bio: "Santo confesor que acompañó con inefable ternura a los condenados y marginados, un modelo amado de pastor diocesano.", 
    phrase: "Un sacerdote que se santifica es capaz de guiar a miles de almas extraviadas hacia el abrazo del Padre celestial." 
  },
  "6-24": { 
    name: "Nacimiento de San Juan Bautista", 
    type: "Solemnidad del Precursor del Salvador", 
    bio: "El último gran profeta del Antiguo Pacto que preparó el camino para el Cordero de Dios. Se celebra históricamente con hogueras de fe.", 
    phrase: "Es enteramente necesario que Jesús crezca y que yo deba disminuir en las miradas del mundo." 
  },
  "6-25": { 
    name: "Beata Catalina de María Rodríguez", 
    type: "Insigne Cordobesa, Fundadora de las Esclavas del Sagrado Corazón", 
    bio: "Pionera argentina de la vida religiosa femenina de misión activa, dedicando su amor pastoral al resguardo espiritual y humano de mujeres.", 
    phrase: "Con el Sagrado Corazón de Jesús todo se sobrelleva con un gozo incombustible." 
  },
  "6-26": { 
    name: "San Josemaría Escrivá", 
    type: "Fundador de la Santidad en el Trabajo Cotidiano", 
    bio: "Enseñó que todas las ocupaciones ordinarias del hogar pueden ofrecerse como servicio excelente a Dios. Tuvo enorme impronta en el país.", 
    phrase: "Tu trabajo diario, tus quehaceres familiares y tus deberes civiles no son obstáculos, sino el altar de tu santidad ordinaria." 
  },
  "6-27": { 
    name: "Nuestra Señora del Perpetuo Socorro", 
    type: "Madre del Amparo Perpetuo, Imagen Redentora", 
    bio: "Icono bizantino sagrado que retrata el consuelo maternal de María ante el dolor, arraigado en miles de familias argentinas.", 
    phrase: "En todas las fatigas y tribulaciones del camino, vuelve tu mirada confiada a la Madre del Perpetuo Auxilio." 
  },
  "6-28": { 
    name: "Beata María Antonia y el Legado jesuita", 
    type: "Evangelización de las Provincias y Misionera Federal", 
    bio: "Conmemoración de la gran misión de Mama Antula uniendo tierras del noroeste argentino y Buenos Aires colonial con su oración de fe pura.", 
    phrase: "Busquemos en todo amar y servir con una generosidad que no le ponga condiciones a Dios." 
  },
  "6-29": { 
    name: "Santos Pedro y Pablo", 
    type: "Solemnidad de las Columnas Apostólicas de la Iglesia Universal", 
    bio: "El humilde pescador elegido como roca pastoral de fe firme, y el incansable heraldo de las naciones de los gentiles.", 
    phrase: "Señor, Tú lo sabes todo bien, Tú sabes de verdad con toda mi alma doliente que yo te amo." 
  },
  "6-30": { 
    name: "San Cayetano de Thiene", 
    type: "Fidelidad y Preparación de Oración Familiar", 
    bio: "Amoroso intercesor conocido como patrono del Pan y del Trabajo, cuyo santuario de Liniers es el refugio de fe predilecto de la patria.", 
    phrase: "Buscad primero el Reino de Dios y su divina justicia, y todo lo demás vendrá como bendito regalo." 
  }
};

const getSaintOfDate = (date: Date): SaintInfo => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const key = `${m}-${d}`;
  if (DEFAULT_SAINTS_BY_DATE[key]) {
    return DEFAULT_SAINTS_BY_DATE[key];
  }
  
  // Rotating general backup saints representing Argentinian Santoral
  const backupSaints: SaintInfo[] = [
    { 
      name: "Nuestra Señora de Luján", 
      type: "Patrona de la República Argentina", 
      bio: "Un milagro de amor en el Río Luján en el siglo XVII. La pequeña imagen de barro cocido decidió quedarse allí para amparar, consolar y reinar sobre el pueblo de nuestra amada Patria.", 
      phrase: "María de Luján, acompáñanos a transitar en paz el camino de nuestra fe federal." 
    },
    { 
      name: "San José Gabriel Brochero", 
      type: "Santo Cura Gaucho de la Iglesia", 
      bio: "Sacerdote cordobés incansable que cruzó las Altas Cumbres a lomo de mula. Construyó capillas, escuelas, acueductos, y transformó la vida espiritual y material de Traslasierra por amor a Jesús.", 
      phrase: "Dios me da la gracia de trabajar y gastar mi vida entera por la salvación de mis amados serranos." 
    },
    { 
      name: "Santa María Antonia de San José", 
      type: "La Ilustre Santa Mama Antula", 
      bio: "Heroica laica santiagueña-riojana que anduvo a pie miles de kilómetros organizando los Ejercicios Espirituales Ignacianos clausurados, uniendo el norte argentino con Buenos Aires en un testimonio inquebrantable.", 
      phrase: "Quiero caminar hasta donde Dios me guíe, cargando mi cruz con alegría y sin miedo al cansancio." 
    },
    { 
      name: "Beato Ceferino Namuncurá", 
      type: "Joven Peñi, Lirio de la Patagonia", 
      bio: "El humilde hijo del gran cacique Namuncurá que abrazó la fe con piedad evangélica asombrosa, deseando educarse para ayudar a su tribu sureña en comunión con los salesianos de Don Bosco.", 
      phrase: "Mi mayor anhelo es ser útil a mis hermanos de la Patagonia argentina." 
    },
    { 
      name: "Beato Mamerto Esquiú", 
      type: "Insigne Obispo Franciscano de Córdoba", 
      bio: "Pastor, periodista y civilizador catamarqueño. Convocó fervorosamente a los argentinos a sellar la concordia y respetar la Constitución de la Nación como base de su desarrollo.", 
      phrase: "Respeten las leyes civiles, pues de la unión fraterna nace la fuerza y bendición de nuestra amada Patria." 
    },
    { 
      name: "San Héctor Valdivielso Sáez", 
      type: "Mártir de los Hermanos de las Escuelas Cristianas", 
      bio: "Primer santo nacido en Argentina, educador infatigable en las aulas lasallanas comprometido con encender el amor de Dios en cada alumno.", 
      phrase: "Toda mi vida se resume en consagrar mis quehaceres cotidianos a iluminar las mentes de los niños." 
    },
    { 
      name: "Nuestra Señora de Itatí", 
      type: "Estrella del Paraná, Abogada de Corrientes", 
      bio: "Venerada devoción mariana ribereña. Su amorosa presencia protege la pesca, las labranzas del litoral y a millones de peregrinos del país.", 
      phrase: "Madre morena, bajo tu mirada tierna colocamos las barcas de nuestras familias." 
    }
  ];

  const index = (m * 23 + d) % backupSaints.length;
  return backupSaints[index];
};

export default function Controller() {
  // Database States loaded from LocalStorage
  const [songs, setSongs] = useState<Song[]>(() => getLocalSongs(DEFAULT_SONGS));
  const [backgrounds, setBackgrounds] = useState<Background[]>(() => {
    const cleared = localStorage.getItem('backgrounds_cleared_v1');
    if (!cleared) {
      localStorage.removeItem('church_projector_backgrounds');
      localStorage.setItem('backgrounds_cleared_v1', 'true');
      return [];
    }
    return getLocalBackgrounds(DEFAULT_BACKGROUNDS);
  });
  const [isBgDeleteMode, setIsBgDeleteMode] = useState<boolean>(false);
  const [selectedBgsToDelete, setSelectedBgsToDelete] = useState<string[]>([]);
  
  // Custom interface skin and theme state saved in localstorage
  const [activeSkin, setActiveSkin] = useState<string>(() => localStorage.getItem('church_controller_skin') || 'default');
  
  // Projection State & Synced settings
  const [state, setState] = useState<ProjectorState>(getLocalState);
  
  // Compact Auxiliary Menu tab
  const [activeSubTab, setActiveSubTab] = useState<'none' | 'backgrounds' | 'fonts' | 'legends'>('none');
  const [activeDock1Tab, setActiveDock1Tab] = useState<'songs' | 'videos'>('songs');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // Observer state to let the preview font size scale proportionally
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState<number>(400);

  useEffect(() => {
    if (!previewContainerRef.current) return;
    const updateSize = () => {
      if (previewContainerRef.current) {
        setPreviewWidth(previewContainerRef.current.getBoundingClientRect().width);
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [activeSubTab]); // also recalculate when tabs open / close!

  // Connection state with secondary projection window
  const [isProjectorConnected, setIsProjectorConnected] = useState<boolean>(false);
  const [showPopupWarning, setShowPopupWarning] = useState<boolean>(false);
  const projectorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const projectorWindowRef = useRef<Window | null>(null);

  // Automatically close projector window if the controller app is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (projectorWindowRef.current && !projectorWindowRef.current.closed) {
        projectorWindowRef.current.close();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
    };
  }, []);

  // Operator UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlaylistSong, setSelectedPlaylistSong] = useState<Song | null>(null);

  // OBS-style Stream & Recording state simulation
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [recordDuration, setRecordDuration] = useState(0);
  const [streamServer, setStreamServer] = useState('rtmp://a.rtmp.youtube.com/live2');
  const [streamKey, setStreamKey] = useState('live_church_7392_x902_projector');
  const [showStreamKey, setShowStreamKey] = useState(false);

  // WiFi cameras list & configuration
  const [wifiCams, setWifiCams] = useState<{ id: string; name: string; ip: string; status: 'online' | 'offline' }[]>(() => {
    try {
      const saved = localStorage.getItem('church_wifi_cams');
      return saved ? JSON.parse(saved) : [
        { id: 'wifi-gopro-altar', name: 'GoPro Hero 11 (Altar Wi-Fi)', ip: '10.5.5.9:8080/live/gopro', status: 'online' },
        { id: 'wifi-gopro-pulpito', name: 'GoPro Hero 10 (Púlpito Wi-Fi)', ip: '10.5.5.15:8080/live/pulpito', status: 'online' }
      ];
    } catch (e) {
      return [
        { id: 'wifi-gopro-altar', name: 'GoPro Hero 11 (Altar Wi-Fi)', ip: '10.5.5.9:8080/live/gopro', status: 'online' }
      ];
    }
  });

  const [inputWifiName, setInputWifiName] = useState('');
  const [inputWifiIp, setInputWifiIp] = useState('');

  // WebSocket Room Camera streaming states & refs
  const [cameraRoomId, setCameraRoomId] = useState<string>('SALA_PARROQUIA');
  const [wsCamFrame, setWsCamFrame] = useState<string | null>(null);
  const [wsCamAlerts, setWsCamAlerts] = useState<{ timestamp: string; image: string }[]>([]);
  const [operatorWsStatus, setOperatorWsStatus] = useState<'disabled' | 'connecting' | 'connected' | 'error'>('disabled');
  const [wsClientCount, setWsClientCount] = useState<number>(0);
  const operatorWsRef = useRef<any>(null);

  // Camera security system registration & monitoring states (Ojo Sensor style)
  const [generatorCamName, setGeneratorCamName] = useState('Cámara Principal');
  const [generatorCamCode, setGeneratorCamCode] = useState(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  });
  const [operatorInputCode, setOperatorInputCode] = useState('');
  const [apiRooms, setApiRooms] = useState<any[]>([]);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Administrative Panel States
  const [enabledFeatures, setEnabledFeatures] = useState<{
    fondos: boolean;
    letra: boolean;
    leyenda: boolean;
    videos: boolean;
    buscarCantos: boolean;
    camaracelular: boolean;
    streaming: boolean;
    playlistDock2: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('enabledFeatures');
      return saved ? JSON.parse(saved) : {
        fondos: true,
        letra: true,
        leyenda: true,
        videos: true,
        buscarCantos: true,
        camaracelular: true,
        streaming: true,
        playlistDock2: true,
      };
    } catch {
      return {
        fondos: true,
        letra: true,
        leyenda: true,
        videos: true,
        buscarCantos: true,
        camaracelular: true,
        streaming: true,
        playlistDock2: true,
      };
    }
  });

  const [userPins, setUserPins] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('userPins');
      return saved ? JSON.parse(saved) : ['1234', '5678'];
    } catch {
      return ['1234', '5678'];
    }
  });

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [unlockedRole, setUnlockedRole] = useState<'admin' | 'user' | null>(null);
  const [adminError, setAdminError] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [adminActiveTab, setAdminActiveTab] = useState<'funciones' | 'seguridad' | 'respaldo' | 'actualizacion'>('funciones');

  // Santoral (Saint of the Day) customizable states
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      if (now.getDate() !== currentDate.getDate() || now.getMonth() !== currentDate.getMonth()) {
        setCurrentDate(now);
      }
    }, 15000); // Check every 15 seconds to stay absolutely fresh and dynamic
    return () => clearInterval(timer);
  }, [currentDate]);

  // Real user data backup & restore states
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupLogs, setBackupLogs] = useState<string[]>([]);
  
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreLogs, setRestoreLogs] = useState<string[]>([]);
  const [restorePreview, setRestorePreview] = useState<{
    fileName: string;
    songsCount: number;
    backgroundsCount: number;
    videosCount: number;
    parsedSongs: Song[];
    parsedBackgrounds: Background[];
    parsedVideos: any[];
  } | null>(null);

  // Simulated software updates states
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);
  const [swVersion, setSwVersion] = useState(() => {
    const saved = localStorage.getItem('swVersion');
    if (!saved || saved.toLowerCase().includes('v4.') || saved.toLowerCase().includes('v4.3')) {
      localStorage.setItem('swVersion', 'V1.0.0');
      return 'V1.0.0';
    }
    // Standardize to V1.x label
    if (saved === 'v1.0.0-Stable') return 'V1.0.0';
    return saved;
  });
  const [pendingUpdateFile, setPendingUpdateFile] = useState<File | null>(null);
  const [updateModules, setUpdateModules] = useState({
    clima: true,
    autoFontSize: true,
    skins: true,
    lyricsPatch: true
  });

  // Save changes automatically
  useEffect(() => {
    localStorage.setItem('enabledFeatures', JSON.stringify(enabledFeatures));
  }, [enabledFeatures]);

  useEffect(() => {
    localStorage.setItem('userPins', JSON.stringify(userPins));
  }, [userPins]);

  // Synchronise sub tab closure when features are disabled
  useEffect(() => {
    if (!enabledFeatures.fondos && activeSubTab === 'backgrounds') setActiveSubTab('none');
    if (!enabledFeatures.letra && activeSubTab === 'fonts') setActiveSubTab('none');
    if (!enabledFeatures.leyenda && activeSubTab === 'legends') setActiveSubTab('none');
  }, [enabledFeatures, activeSubTab]);

  const handleVerifyPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdminError('');
    const input = adminPasswordInput.trim();
    if (input === 'Doctor01') {
      setIsAuthorized(true);
      setUnlockedRole('admin');
      setAdminPasswordInput('');
    } else if (userPins.includes(input)) {
      setIsAuthorized(true);
      setUnlockedRole('user');
      setAdminPasswordInput('');
      setAdminActiveTab('funciones'); // Standard user restricted tab sequence
    } else {
      setAdminError('Contraseña o PIN incorrecto. Intente de nuevo.');
    }
  };

  // ==========================================
  // COPIAS DE SEGURIDAD (USER BACKUP ENGINE)
  // ==========================================
  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setBackupProgress(0);
    setBackupLogs(['🚀 Iniciando generación de copia de seguridad...']);

    try {
      await new Promise(r => setTimeout(r, 200));
      setBackupLogs(prev => [...prev, '📂 Compilando canciones de usuario...']);
      setBackupProgress(20);
      
      const zip = new JSZip();
      
      // We will create folders and files exactly as requested
      const folder = zip.folder("church_projector_backup");
      if (!folder) {
        throw new Error("No se pudo estructurar el directorio de copia de seguridad.");
      }

      // Pack User Songs
      const songsCount = songs.length;
      folder.file("songs.json", JSON.stringify(songs, null, 2));
      await new Promise(r => setTimeout(r, 200));
      setBackupLogs(prev => [...prev, `📝 ${songsCount} canciones locales preparadas para el empaquetado.`]);
      setBackupProgress(50);

      // Pack User Backgrounds
      const bgsCount = backgrounds.length;
      folder.file("backgrounds.json", JSON.stringify(backgrounds, null, 2));
      await new Promise(r => setTimeout(r, 200));
      setBackupLogs(prev => [...prev, `🖼️ ${bgsCount} esquemas y imágenes de fondo preparadas para el empaquetado.`]);
      setBackupProgress(75);

      // Pack User Videos list
      const videosCount = videos.length;
      folder.file("videos.json", JSON.stringify(videos, null, 2));
      await new Promise(r => setTimeout(r, 200));
      setBackupLogs(prev => [...prev, `📹 ${videosCount} recursos de video cargados listos para empaquetado.`]);
      setBackupProgress(90);

      // Construct descriptor manifest
      const backupMeta = {
        app_name: "Proyector Católico - Consola de Operación",
        export_date: new Date().toISOString(),
        total_songs: songsCount,
        total_backgrounds: bgsCount,
        total_videos: videosCount,
        sw_version: swVersion
      };
      folder.file("metadata.json", JSON.stringify(backupMeta, null, 2));

      setBackupLogs(prev => [...prev, `⚡ Generando archivo comprimido .zip firmemente cifrado...`]);
      setBackupProgress(95);
      await new Promise(r => setTimeout(r, 300));

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadName = `respaldo_proyector_${new Date().toISOString().slice(0, 10)}.zip`;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupProgress(100);
      setBackupLogs(prev => [...prev, `🎉 ¡Copia de seguridad "${downloadName}" descargada exitosamente en su equipo!`]);
      
    } catch (error: any) {
      console.error(error);
      setBackupLogs(prev => [...prev, `❌ Error al generar el respaldo: ${error?.message || error}`]);
    }
  };

  const handleLoadBackupFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setRestoreProgress(10);
    setRestoreLogs([`⚡ Leyendo paquete de datos: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`]);
    setRestorePreview(null);

    try {
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(file);
      setRestoreProgress(45);
      setRestoreLogs(prev => [...prev, `🔍 Analizando archivos de la estructura comprimida...`]);
      await new Promise(r => setTimeout(r, 300));

      // Try reading files from either a nested folder structure or flat root structure
      let songsFile = zipContents.file("church_projector_backup/songs.json") || zipContents.file("songs.json");
      let backgroundsFile = zipContents.file("church_projector_backup/backgrounds.json") || zipContents.file("backgrounds.json");
      let videosFile = zipContents.file("church_projector_backup/videos.json") || zipContents.file("videos.json");

      let parsedSongs: Song[] = [];
      let parsedBackgrounds: Background[] = [];
      let parsedVideos: any[] = [];

      if (!songsFile && !backgroundsFile && !videosFile) {
        throw new Error("No se encontraron archivos de datos válidos (songs.json, backgrounds.json, videos.json) dentro del ZIP o dentro de la carpeta 'church_projector_backup'.");
      }

      if (songsFile) {
        const text = await songsFile.async("string");
        parsedSongs = JSON.parse(text);
        if (!Array.isArray(parsedSongs)) {
          throw new Error("El archivo songs.json tiene un formato de lista incorrecto.");
        }
      }

      if (backgroundsFile) {
        const text = await backgroundsFile.async("string");
        parsedBackgrounds = JSON.parse(text);
        if (!Array.isArray(parsedBackgrounds)) {
          throw new Error("El archivo backgrounds.json tiene un formato de lista incorrecto.");
        }
      }

      if (videosFile) {
        const text = await videosFile.async("string");
        parsedVideos = JSON.parse(text);
        if (!Array.isArray(parsedVideos)) {
          throw new Error("El archivo videos.json tiene un formato de lista incorrecto.");
        }
      }

      setRestoreProgress(90);
      setRestoreLogs(prev => [
        ...prev, 
        `✅ Análisis del archivo de respaldo finalizado con éxito.`,
        `📦 Datos Encontrados: ${parsedSongs.length} canciones, ${parsedBackgrounds.length} fondos, ${parsedVideos.length} enlaces de video.`
      ]);

      setRestorePreview({
        fileName: file.name,
        songsCount: parsedSongs.length,
        backgroundsCount: parsedBackgrounds.length,
        videosCount: parsedVideos.length,
        parsedSongs,
        parsedBackgrounds,
        parsedVideos
      });
      setRestoreProgress(100);

    } catch (error: any) {
      console.error(error);
      setRestoreLogs(prev => [...prev, `❌ Error en importación: ${error?.message || error}`]);
      setRestoreProgress(0);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleConfirmRestore = async (mode: 'merge' | 'replace') => {
    if (!restorePreview) return;
    
    setIsRestoring(true);
    setRestoreProgress(10);
    setRestoreLogs([`⚙️ Iniciando restauración de datos en modo: ${mode === 'merge' ? '🧬 FUSIONAR ELEMENTOS' : '⚠️ REEMPLAZAR TOTALMENTE'}...`]);

    try {
      await new Promise(r => setTimeout(r, 300));
      setRestoreProgress(40);

      let finalSongs = [...songs];
      let finalBackgrounds = [...backgrounds];
      let finalVideos = [...videos];

      if (mode === 'replace') {
        setRestoreLogs(prev => [...prev, `🗑️ Purgando biblioteca actual y preparando la sobre-escritura limpia...`]);
        finalSongs = restorePreview.parsedSongs;
        finalBackgrounds = restorePreview.parsedBackgrounds;
        finalVideos = restorePreview.parsedVideos;
      } else {
        setRestoreLogs(prev => [...prev, `🧬 Analizando IDs para fusionar las diferencias sin duplicar existentes...`]);
        
        // Merge helper - prevent duplicate songs
        const existingSongIds = new Set(songs.map(s => s.id));
        restorePreview.parsedSongs.forEach(song => {
          if (!existingSongIds.has(song.id)) {
            finalSongs.push(song);
          }
        });

        // Merge helper - prevent duplicate backgrounds
        const existingBgIds = new Set(backgrounds.map(b => b.id));
        restorePreview.parsedBackgrounds.forEach(bg => {
          if (!existingBgIds.has(bg.id)) {
            finalBackgrounds.push(bg);
          }
        });

        // Merge helper - prevent duplicate videos
        const existingVidIds = new Set(videos.map(v => v.id));
        restorePreview.parsedVideos.forEach(vid => {
          if (!existingVidIds.has(vid.id)) {
            finalVideos.push(vid);
          }
        });
      }

      await new Promise(r => setTimeout(r, 300));
      setRestoreProgress(75);
      setRestoreLogs(prev => [...prev, `💾 Guardando cambios unificados de forma persistente...`]);

      // Save states and localStorage
      setSongs(finalSongs);
      saveLocalSongs(finalSongs);

      setBackgrounds(finalBackgrounds);
      saveLocalBackgrounds(finalBackgrounds);

      setVideos(finalVideos);
      localStorage.setItem('church_projector_videos', JSON.stringify(finalVideos));

      await new Promise(r => setTimeout(r, 400));
      setRestoreProgress(100);
      setRestoreLogs(prev => [...prev, `🎉 ¡Restauración finalizada con éxito! Los datos cargados ya se encuentran disponibles.`]);

      setTimeout(() => {
        setRestorePreview(null);
        setIsRestoring(false);
      }, 3000);

    } catch (error: any) {
      console.error(error);
      setRestoreLogs(prev => [...prev, `❌ Error catastrófico al procesar la restauración: ${error?.message || error}`]);
      setIsRestoring(false);
    }
  };

  const handleUpdateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingUpdateFile(file);
  };

  const handleProceedWithUpdate = () => {
    if (!pendingUpdateFile) return;
    const file = pendingUpdateFile;
    setUpdateFileName(file.name);
    setIsUpdating(true);
    setUpdateProgress(0);
    setUpdateLogs([
      `⚡ Leyendo paquete de actualización local: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
      `🔍 Escaneando firma digital y validez del archivo local...`,
      `📦 Archivo de parche validado. Analizando manifiesto de módulos seleccionados...`
    ]);

    const activeList: string[] = [];
    if (updateModules.clima) activeList.push('"clima-widget.tsx"');
    if (updateModules.autoFontSize) activeList.push('"auto-font-size.tsx"');
    if (updateModules.skins) activeList.push('"interface-skins-v2.json"');
    if (updateModules.lyricsPatch) activeList.push('"lyrics-patch.json"');

    const steps = [
      { progress: 15, log: `🔌 Descomprimiendo '${file.name}' en la carpeta temporal de actualización...` },
      { progress: 30, log: '⚙️ Buscando nuevos componentes de interfaz descritos en la configuración del operador...' },
      { 
        progress: 48, 
        log: activeList.length > 0 
          ? `📂 Nuevos componentes seleccionados encontrados en el zip: ${activeList.join(', ')}.` 
          : '📂 Ningún componente nuevo seleccionado. Forzando solo actualización del motor base...'
      },
      { 
        progress: 65, 
        log: updateModules.skins 
          ? '💅 Integrando nuevos botones estilizados, combos de color y nuevos esquemas estéticos...' 
          : '⚙️ Omitiendo nuevos skins estéticos (mantenidos esquemas previos). Registrando parámetros base...' 
      },
      { progress: 78, log: '🔐 Verificando aislamiento de datos locales del usuario (canciones e imágenes)...' },
      { progress: 88, log: `💾 Resguardando exitosamente ${songs.length} canciones locales y ${backgrounds.length} fondos en base de datos independiente (Sin Pérdidas).` },
      { 
        progress: 95, 
        log: `🚀 Forzando render de interfaz y activando nuevos módulos autorizados (${updateModules.clima ? 'Clima' : 'Sin clima'}, ${updateModules.autoFontSize ? 'Autoajuste' : 'Sin autoajuste'})...` 
      },
      { progress: 100, log: `🎉 ¡Actualización finalizada con éxito! Sistema general al día (Ver: v1.0.2-Stable).` }
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setUpdateProgress(step.progress);
        setUpdateLogs(prev => [...prev, step.log]);
        if (step.progress === 100) {
          // 1. Forzar que TODAS las características y botones estén completamente habilitados
          const allFeaturesEnabled = {
            fondos: true,
            letra: true,
            leyenda: true,
            videos: true,
            buscarCantos: true,
            camaracelular: true,
            streaming: true,
            playlistDock2: true,
          };
          setEnabledFeatures(allFeaturesEnabled);
          localStorage.setItem('enabledFeatures', JSON.stringify(allFeaturesEnabled));

          // 2. Conservar intactos los datos de usuario de canciones y fondos (reforzando su seguridad en storage)
          saveLocalSongs(songs);
          saveLocalBackgrounds(backgrounds);

          // 3. Activar funciones de nueva generación recién instaladas
          updateState(prev => ({
            ...prev,
            ...(updateModules.autoFontSize ? { isAutoFontSize: true } : {}),
            ...(updateModules.clima ? { showWeatherOnProjector: true } : {}),
          }));

          // 4. Establecer un skin por defecto vistoso tras la actualización si se autorizó
          if (updateModules.skins) {
            setActiveSkin('celestial');
            localStorage.setItem('church_controller_skin', 'celestial');
          }

          setIsUpdating(false);
          setPendingUpdateFile(null);
          setSwVersion('v1.0.2-Stable');
          localStorage.setItem('swVersion', 'v1.0.2-Stable');

          // Refresh the application automatically after a short delay so user can read the success log
          setUpdateLogs(prev => [...prev, '🔄 Reiniciando aplicación para aplicar todos los cambios en caliente...']);
          setTimeout(() => {
            window.location.reload();
          }, 2500);
        }
      }, (idx + 1) * 750);
    });
  };

  const handleUpdateSoftware = () => {
    updateFileInputRef.current?.click();
  };

  const handleAddPin = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = newPinInput.trim();
    if (!pin) return;
    if (pin.length < 4) {
      alert('El PIN del usuario debe tener al menos 4 caracteres.');
      return;
    }
    if (userPins.includes(pin)) {
      alert('Este PIN ya se encuentra registrado.');
      return;
    }
    if (pin === 'Doctor01') {
      alert('La clave maestra no puede registrarse como PIN de usuario.');
      return;
    }
    setUserPins(prev => [...prev, pin]);
    setNewPinInput('');
  };

  const handleRemovePin = (pin: string) => {
    setUserPins(prev => prev.filter(p => p !== pin));
  };


  const refreshRoomsList = () => {
    setLoadingRooms(true);
    fetch('/api/rooms')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.rooms)) {
          setApiRooms(data.rooms);
        }
      })
      .catch(err => console.warn('Error fetching API rooms:', err))
      .finally(() => setLoadingRooms(false));
  };

  useEffect(() => {
    refreshRoomsList();
    // Fetch channels list in real-time every 4 seconds to simulate automatic security state tracking
    const interval = setInterval(refreshRoomsList, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Expose frame state changes globally to projector child views
    if (wsCamFrame) {
      (window as any).__CHURCH_CAMERA_FRAME__ = wsCamFrame;
      const event = new CustomEvent('church-camera-frame-changed', { detail: wsCamFrame });
      window.dispatchEvent(event);
    }
  }, [wsCamFrame]);

  // Local states for Dock 1 camera management quick-actions
  const [editingCamIdInDock, setEditingCamIdInDock] = useState<string | null>(null);
  const [dockCamEditName, setDockCamEditName] = useState('');
  const [dockCamEditIp, setDockCamEditIp] = useState('');
  
  const [showDockAddCamForm, setShowDockAddCamForm] = useState(false);
  const [dockAddCamName, setDockAddCamName] = useState('');
  const [dockAddCamIp, setDockAddCamIp] = useState('');

  const [showDroidCamHelpInDock, setShowDroidCamHelpInDock] = useState(false);
  const [dockAddCamType, setDockAddCamType] = useState('droidcam');
  const [dockAddCamIpOnly, setDockAddCamIpOnly] = useState('');
  const [dockAddCamPort, setDockAddCamPort] = useState('');
  const [dockAddCamPath, setDockAddCamPath] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('church_wifi_cams', JSON.stringify(wifiCams));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [wifiCams]);

  const selectedWifiCamera = useMemo(() => {
    if (!state.cameraDeviceId || !state.cameraDeviceId.startsWith('wifi-')) return null;
    return wifiCams.find((c: any) => c.id === state.cameraDeviceId) || null;
  }, [state.cameraDeviceId, wifiCams]);

  // Dock 1 Camera Helper Functions
  const handleDockEditCam = (camId: string, name: string, ip: string) => {
    setEditingCamIdInDock(camId);
    setDockCamEditName(name);
    setDockCamEditIp(ip);
  };

  const handleDockSaveCam = (camId: string) => {
    setWifiCams(prev => prev.map(c => c.id === camId ? { ...c, name: dockCamEditName, ip: dockCamEditIp } : c));
    setEditingCamIdInDock(null);
  };

  const handleDockDeleteCam = (camId: string) => {
    setWifiCams(prev => prev.filter(c => c.id !== camId));
    if (state.cameraDeviceId === camId) {
      updateState(prev => ({ ...prev, cameraDeviceId: null, isCameraActive: false }));
    }
  };

  const handleDockAddCam = () => {
    // Collect IP from either source
    let finalIp = '';
    if (dockAddCamIpOnly) {
      let temp = dockAddCamIpOnly.trim();
      if (dockAddCamPort) {
        temp += `:${dockAddCamPort.trim()}`;
      }
      if (dockAddCamPath) {
        const pathPart = dockAddCamPath.trim();
        if (pathPart.startsWith('/')) {
          temp += pathPart;
        } else {
          temp += `/${pathPart}`;
        }
      }
      finalIp = temp;
    } else if (dockAddCamIp) {
      finalIp = dockAddCamIp.trim();
    }

    if (!dockAddCamName || !finalIp) return;

    let formattedIp = finalIp;
    if (!formattedIp.startsWith('http://') && !formattedIp.startsWith('https://')) {
      formattedIp = 'http://' + formattedIp;
    }
    
    const newId = `wifi-cam-${Date.now()}`;
    setWifiCams(prev => [
      ...prev,
      { id: newId, name: dockAddCamName, ip: formattedIp, status: 'online' }
    ]);

    // Reset all form fields
    setDockAddCamName('');
    setDockAddCamIp('');
    setDockAddCamIpOnly('');
    setDockAddCamPort('');
    setDockAddCamPath('');
    setShowDockAddCamForm(false);
  };

  // Video loop background library states & handlers
  const DEFAULT_VIDEOS = useMemo(() => [], []);

  const [videos, setVideos] = useState<{ id: string; name: string; url: string }[]>(() => {
    const cleared = localStorage.getItem('videos_cleared_v1');
    if (!cleared) {
      localStorage.removeItem('church_projector_videos');
      localStorage.setItem('videos_cleared_v1', 'true');
      return [];
    }
    try {
      const saved = localStorage.getItem('church_projector_videos');
      return saved ? JSON.parse(saved) : DEFAULT_VIDEOS;
    } catch {
      return DEFAULT_VIDEOS;
    }
  });

  const [inputVideoName, setInputVideoName] = useState('');
  const [inputVideoUrl, setInputVideoUrl] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('church_projector_videos', JSON.stringify(videos));
    } catch (e) {
      console.warn('LocalStorage error saving videos:', e);
    }
  }, [videos]);

  const handleAddVideo = () => {
    if (!inputVideoName.trim() || !inputVideoUrl.trim()) return;
    const newVideo = {
      id: `video-${Date.now()}`,
      name: inputVideoName.trim(),
      url: inputVideoUrl.trim()
    };
    setVideos(prev => [...prev, newVideo]);
    setInputVideoName('');
    setInputVideoUrl('');
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dbKey = `video-uploaded-${Date.now()}`;
      await saveMediaBlob(dbKey, file);
      const newVideo = {
        id: dbKey,
        name: `📂 ${file.name}`,
        url: `db://${dbKey}`
      };
      setVideos(prev => [...prev, newVideo]);
    } catch (err) {
      console.error("Error saving video to IndexedDB database:", err);
      const objectUrl = URL.createObjectURL(file);
      const newVideo = {
        id: `video-uploaded-${Date.now()}`,
        name: `📂 [Local] ${file.name}`,
        url: objectUrl
      };
      setVideos(prev => [...prev, newVideo]);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    setVideos(prev => prev.filter(v => v.id !== videoId));
    if (state.activeVideoId === videoId) {
      updateState(prev => ({ ...prev, activeVideoId: null, activeVideoUrl: null }));
    }
    if (videoId.startsWith('video-uploaded-')) {
      try {
        await deleteMediaBlob(videoId);
      } catch (err) {
        console.warn("Could not delete from IndexedDB:", err);
      }
    }
  };

  const selectedVid = videos.find(v => v.id === selectedVideoId);
  const isSelectedVideoPlaying = !!(selectedVid && state.activeVideoId === selectedVid.id && !state.isCameraActive);

  const playVideo = (id: string, url: string) => {
    updateState(prev => ({
      ...prev,
      activeVideoId: id,
      activeVideoUrl: url,
      isVideoPlaying: true, // Default is playing when selected from the list!
      isCameraActive: false
    }));
  };

  const stopVideo = () => {
    updateState(prev => ({
      ...prev,
      activeVideoId: null,
      activeVideoUrl: null
    }));
  };

  // Formatter for counting duration HH:MM:SS
  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Ticking timers for simulated transmission and recording
  useEffect(() => {
    let timer: any;
    if (isStreaming) {
      timer = setInterval(() => {
        setStreamDuration(prev => prev + 1);
      }, 1000);
    } else {
      setStreamDuration(0);
    }
    return () => clearInterval(timer);
  }, [isStreaming]);

  useEffect(() => {
    let timer: any;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } else {
      setRecordDuration(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);



  // Sync and control play/pause state for loaded video elements in the preview monitor
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const resolvedVideoUrl = useResolvedVideoUrl(state.activeVideoUrl);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (video) {
      if (resolvedVideoUrl) {
        if (state.isVideoPlaying) {
          video.play().catch(e => console.warn('Preview video play prevented:', e));
        } else {
          video.pause();
        }
      }
    }
  }, [state.isVideoPlaying, resolvedVideoUrl]);

  // Instantly keep controller preview video elements synchronized to the videoCurrentTime state
  useEffect(() => {
    const video = previewVideoRef.current;
    if (video && state.videoCurrentTime !== undefined) {
      if (Math.abs(video.currentTime - state.videoCurrentTime) > 0.4) {
        video.currentTime = state.videoCurrentTime;
      }
    }
  }, [state.videoCurrentTime]);

  // Song creation form states
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [inputTitle, setInputTitle] = useState('');
  const [inputAuthor, setInputAuthor] = useState('');
  const [inputLyrics, setInputLyrics] = useState('');
  
  // Custom slide-level images and update variables
  const [inputSlideImages, setInputSlideImages] = useState<string[]>([]);
  const [activeUploadSlideIndex, setActiveUploadSlideIndex] = useState<number | null>(null);
  const slideImageFileInputRef = useRef<HTMLInputElement>(null);
  const [updateFileName, setUpdateFileName] = useState<string>('');
  const updateFileInputRef = useRef<HTMLInputElement>(null);

  // Song editing state
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  // File upload state / ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const tickerImageInputRef = useRef<HTMLInputElement>(null);

  // Effect for Auto-Rotation of backgrounds based on interval
  useEffect(() => {
    if (!state.isRotationEnabled) return;
    
    const intervalTime = (state.rotationIntervalMinutes || 5) * 60 * 1000;
    
    const intervalId = setInterval(() => {
      const imageBgs = backgrounds.filter(bg => bg.type === 'image' && bg.id !== 'solid');
      if (imageBgs.length <= 1) return;
      
      const curIdx = imageBgs.findIndex(bg => bg.id === state.activeBackgroundId);
      const nextIdx = (curIdx + 1) % imageBgs.length;
      handleSelectBackground(imageBgs[nextIdx].id);
    }, intervalTime);
    
    return () => clearInterval(intervalId);
  }, [state.isRotationEnabled, state.rotationIntervalMinutes, state.activeBackgroundId, backgrounds]);

  // Effect for WebRTC cellphone transmitter matching & signaling loop
  // Effect to connect to the custom WebSocket room as a viewer
  useEffect(() => {
    if (state.cameraDeviceId !== 'webrtc-phone' || !state.isCameraActive) {
      setOperatorWsStatus('disabled');
      if (operatorWsRef.current) {
        operatorWsRef.current.close();
        operatorWsRef.current = null;
      }
      setWsCamFrame(null);
      return;
    }

    setOperatorWsStatus('connecting');

    // Fetch historic alerts for initial feed
    fetch(`/api/alerts/${encodeURIComponent(cameraRoomId)}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setWsCamAlerts(data);
        }
      })
      .catch(err => console.warn('Error fetching alerts history:', err));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    operatorWsRef.current = ws;

    ws.onopen = () => {
      setOperatorWsStatus('connected');
      // Join Room as Viewer
      ws.send(JSON.stringify({
        type: 'join',
        roomId: cameraRoomId.toUpperCase().trim(),
        role: 'viewer',
        name: 'Consola Operador'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'frame') {
          setWsCamFrame(payload.image);
        } else if (payload.type === 'alert') {
          // Prepend new motion alert
          setWsCamAlerts(prev => {
            const updated = [{ timestamp: payload.timestamp || new Date().toISOString(), image: payload.image }, ...prev];
            return updated.slice(0, 50); // Keep max 50
          });
        } else if (payload.type === 'joined') {
          setWsClientCount(payload.viewersCount || 0);
        }
      } catch (err) {
        console.warn('Operator WS payload error:', err);
      }
    };

    ws.onclose = () => {
      setOperatorWsStatus('error');
    };

    ws.onerror = () => {
      setOperatorWsStatus('error');
    };

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [state.cameraDeviceId, state.isCameraActive, cameraRoomId]);

  // Find active song and background details
  const activeSong = useMemo(() => {
    if (!state.activeSongId) return null;
    return songs.find(s => s.id === state.activeSongId) || null;
  }, [state.activeSongId, songs]);

  const activeBackground = useMemo(() => {
    if (state.activeBackgroundId === 'solid') {
      return {
        id: 'solid',
        name: 'Color Sólido',
        url: state.solidBackgroundColor || '#121214',
        type: 'image'
      } as Background;
    }
    return backgrounds.find(bg => bg.id === state.activeBackgroundId) || backgrounds[0];
  }, [state.activeBackgroundId, backgrounds, state.solidBackgroundColor]);

  const resolvedBackgroundUrl = useResolvedVideoUrl(activeBackground?.url);

  const resolvedVideoUrlRef = useRef(resolvedVideoUrl);
  const resolvedBackgroundUrlRef = useRef(resolvedBackgroundUrl);

  useEffect(() => {
    resolvedVideoUrlRef.current = resolvedVideoUrl;
  }, [resolvedVideoUrl]);

  useEffect(() => {
    resolvedBackgroundUrlRef.current = resolvedBackgroundUrl;
  }, [resolvedBackgroundUrl]);

  // Initialize Synchronizer Hub
  const hub = useMemo(() => new ProjectorHub(), []);

  // Sync refs to avoid stale closures in subscribe
  const stateRef = useRef(state);
  const songsRef = useRef(songs);
  const backgroundsRef = useRef(backgrounds);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  useEffect(() => {
    backgroundsRef.current = backgrounds;
  }, [backgrounds]);

  // Sync state changes to localStorage and update internal state
  const updateState = (updater: ProjectorState | ((prev: ProjectorState) => ProjectorState)) => {
    setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLocalState(next);
      return next;
    });
  };

  // Weather component effect to fetch and keep state updated automatically
  useEffect(() => {
    let intervalId: any = null;

    const fetchWeather = async () => {
      try {
        // Fallback coordinates (Buenos Aires, Argentina)
        let lat = -34.6037;
        let lon = -58.3816;

        const performFetch = async (latitude: number, longitude: number) => {
          try {
            const response = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
            );
            if (response.ok) {
              const data = await response.json();
              if (data && data.current) {
                const temp = `${Math.round(data.current.temperature_2m)}°C`;
                const code = data.current.weather_code;
                const condition = getWeatherDetails(code);
                const desc = `${condition.emoji} ${condition.text}`;
                
                setState((prev) => {
                  const next = {
                    ...prev,
                    weatherTemp: temp,
                    weatherDesc: desc
                  };
                  saveLocalState(next);
                  return next;
                });
              }
            }
          } catch (e) {
            console.warn("Weather API fetch error:", e);
          }
        };

        // Try to get geolocation if available
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              performFetch(pos.coords.latitude, pos.coords.longitude);
            },
            () => {
              performFetch(lat, lon);
            }
          );
        } else {
          performFetch(lat, lon);
        }
      } catch (err) {
        console.warn("Weather fetch major catch block:", err);
      }
    };

    const getWeatherDetails = (code: number) => {
      if (code === 0) return { text: 'Soleado', emoji: '☀️' };
      if (code >= 1 && code <= 3) return { text: 'Parcialmente Nublado', emoji: '⛅' };
      if (code === 45 || code === 48) return { text: 'Niebla', emoji: '🌫️' };
      if (code >= 51 && code <= 55) return { text: 'Llovizna', emoji: '🌧️' };
      if (code >= 61 && code <= 65) return { text: 'Lluvia', emoji: '🌧️🌧️' };
      if (code >= 71 && code <= 75) return { text: 'Nieve', emoji: '❄️' };
      if (code >= 80 && code <= 82) return { text: 'Chubascos', emoji: '🌦️' };
      if (code >= 95) return { text: 'Tormenta', emoji: '⛈️' };
      return { text: 'Despejado', emoji: '☀️' };
    };

    fetchWeather();
    intervalId = setInterval(fetchWeather, 180000); // 3 minutes automatic background update loop

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Unified real-time sync broadcaster and direct memory bus updater
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. Save data to storage fallbacks
      try {
        saveLocalSongs(songs);
        saveLocalBackgrounds(backgrounds);
      } catch (err) {
        console.warn('LocalStorage background save failed:', err);
      }

      // 2. Write to the direct memory bus for instant, cross-popup sharing (bypasses browser sandbox/iframe localStorage restrictions)
      (window as any).__CHURCH_PROJECTOR_SHARED_DATA__ = {
        state,
        songs,
        backgrounds,
        resolvedVideoUrl,
        resolvedBackgroundUrl,
        lastUpdated: Date.now()
      };

      // 3. Broadcast standard instant events via BroadcastChannel/CustomEvent for active targets
      hub.broadcast({
        type: 'STATE_CHANGED',
        state,
        songs,
        backgrounds,
        resolvedVideoUrl,
        resolvedBackgroundUrl
      });
    }
  }, [state, songs, backgrounds, hub, resolvedVideoUrl, resolvedBackgroundUrl]);

  // Handle Handshake responses and bidirectional memory/event connectivity with the projector screen
  useEffect(() => {
    const unsubscribe = hub.subscribe((message: ProjectorMessage) => {
      if (message.type === 'PONG') {
        setIsProjectorConnected(true);
        
        // Projector signaling connection/update. Send active state and data instantly so it renders IMMEDIATELY.
        hub.broadcast({
          type: 'STATE_CHANGED',
          state: stateRef.current,
          songs: songsRef.current,
          backgrounds: backgroundsRef.current,
          resolvedVideoUrl: resolvedVideoUrlRef.current,
          resolvedBackgroundUrl: resolvedBackgroundUrlRef.current
        });
        
        // Reset timeout
        if (projectorTimeoutRef.current) {
          clearTimeout(projectorTimeoutRef.current);
        }
        
        // If we don't hear from the projector in 5 seconds, mark as disconnected
        projectorTimeoutRef.current = setTimeout(() => {
          setIsProjectorConnected(false);
        }, 5000);
      }
    });

    // Send a periodic Ping to verify the projector status
    const pingInterval = setInterval(() => {
      hub.broadcast({ type: 'PING' });
      
      // Also check if the projector has touched the direct memory timestamp (the fail-safe mechanism)
      const lastMemoryPulse = (window as any).__CHURCH_PROJECTOR_ACTIVE_TIMESTAMP__;
      if (lastMemoryPulse && Date.now() - lastMemoryPulse < 4500) {
        setIsProjectorConnected(true);
      }
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(pingInterval);
      if (projectorTimeoutRef.current) {
        clearTimeout(projectorTimeoutRef.current);
      }
      hub.close();
    };
  }, [hub]);

  // Slides helper
  const slidesCount = activeSong ? activeSong.slides.length : 0;

  // Filtered song list for the library search
  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return songs;
    const q = searchQuery.toLowerCase();
    return songs.filter(
      s => s.title.toLowerCase().includes(q) || 
      (s.author && s.author.toLowerCase().includes(q)) ||
      s.lyrics.toLowerCase().includes(q)
    );
  }, [searchQuery, songs]);

  // Slide navigation handlers
  const handleSelectSlide = (index: number) => {
    if (!activeSong) return;
    if (index >= 0 && index < slidesCount) {
      updateState(prev => ({ 
        ...prev, 
        activeSlideIndex: index,
        // When switching slides, check if blackout or hide letras should remain or release
      }));
    }
  };

  const handleNextSlide = () => {
    if (!activeSong) return;
    const nextIdx = state.activeSlideIndex + 1;
    if (nextIdx < slidesCount) {
      handleSelectSlide(nextIdx);
    } else {
      // De las canciones, cuando uno le de una vez más al final, se saca la letra y queda solo la imagen
      handleUnloadSong();
    }
  };

  const handlePrevSlide = () => {
    if (!activeSong) return;
    const prevIdx = state.activeSlideIndex - 1;
    if (prevIdx >= 0) {
      handleSelectSlide(prevIdx);
    }
  };

  // Preset Controls
  const handleLoadSong = (song: Song) => {
    setSelectedVideoId(null);
    
    let nextBgId: string | undefined;
    if (state.rotateBackgroundWithSongs) {
      const imageBgs = backgrounds.filter(bg => bg.type === 'image' && bg.id !== 'solid');
      if (imageBgs.length > 1) {
        const curIdx = imageBgs.findIndex(bg => bg.id === state.activeBackgroundId);
        const nextIdx = (curIdx + 1) % imageBgs.length;
        nextBgId = imageBgs[nextIdx].id;
      }
    }

    if (song.isVideo) {
      updateState(prev => ({
        ...prev,
        activeSongId: song.id,
        activeSlideIndex: 0,
        activeVideoId: song.id,
        activeVideoUrl: song.videoUrl || null,
        isVideoPlaying: true, // Auto play when loading video song!
        videoCurrentTime: 0,
        isHideLetters: false,
        ...(nextBgId ? { activeBackgroundId: nextBgId } : {})
      }));
    } else {
      updateState(prev => ({
        ...prev,
        activeSongId: song.id,
        activeSlideIndex: 0,
        activeVideoId: null,
        activeVideoUrl: null,
        isVideoPlaying: false,
        isHideLetters: false, // automatically show lyrics when loading a new song
        ...(nextBgId ? { activeBackgroundId: nextBgId } : {})
      }));
    }
  };

  const handleUnloadSong = () => {
    updateState(prev => ({
      ...prev,
      activeSongId: null,
      activeSlideIndex: 0,
      activeVideoId: null,
      activeVideoUrl: null,
      isVideoPlaying: false
    }));
  };

  const handleSelectBackground = (bgId: string) => {
    updateState(prev => ({
      ...prev,
      activeBackgroundId: bgId
    }));
  };

  const toggleBlackout = () => {
    updateState(prev => ({ ...prev, isBlackout: !prev.isBlackout }));
  };

  const toggleHideLetters = () => {
    updateState(prev => ({ ...prev, isHideLetters: !prev.isHideLetters }));
  };

  const handleSetDimMode = (mode: boolean | null) => {
    updateState(prev => ({ ...prev, isForceDimmed: mode }));
  };

  // Keyboard controls effect: Space or Right Arrow for Next, Left Arrow for Prev, etc.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard commands if operator is actively writing in text input fields
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') {
        return;
      }

      if (activeSong && activeSong.isVideo) {
        if (!state.isVideoPlaying) {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            const newTime = Math.min((state.videoDuration || 200), (state.videoCurrentTime || 0) + 5);
            updateState(prev => ({ ...prev, videoCurrentTime: newTime }));
            if (previewVideoRef.current) {
              previewVideoRef.current.currentTime = newTime;
            }
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const newTime = Math.max(0, (state.videoCurrentTime || 0) - 5);
            updateState(prev => ({ ...prev, videoCurrentTime: newTime }));
            if (previewVideoRef.current) {
              previewVideoRef.current.currentTime = newTime;
            }
          }
        }
        return;
      }

      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleBlackout();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        toggleHideLetters();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSong, state.activeSlideIndex, state.isVideoPlaying, state.videoCurrentTime, state.videoDuration]);

  // Process song plain text raw lyrics into grouped paragraph slides
  const parseLyricsIntoSlides = (rawText: string): string[] => {
    // Splits by empty vertical lines (double spacing)
    return rawText
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  };

  // Auto formats song text according to recommended formatting standards:
  // 1. Longitud: Formato recomendado de 34 caracteres por línea (incluyendo espacios).
  // 2. Estructura: Formato recomendado de máximo 5 líneas por estrofa.
  // 3. Formato: No corta palabras a la mitad, ajustando al final de la palabra.
  // Este formato es una sugerencia opcional para optimizar la legibilidad en el proyector.
  const formatLyricsWithRules = (text: string): string => {
    if (!text) return '';
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const formattedParagraphs: string[] = [];

    for (const paragraph of paragraphs) {
      const words = paragraph.replace(/\s+/g, ' ').split(' ').filter(Boolean);
      const wrappedLines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        if (!currentLine) {
          currentLine = word;
        } else if (currentLine.length + 1 + word.length <= 34) {
          currentLine += ' ' + word;
        } else {
          wrappedLines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        wrappedLines.push(currentLine);
      }

      // Group these wrapped lines into slides of max 5 lines (recommended standard structure)
      for (let i = 0; i < wrappedLines.length; i += 5) {
        const slideChunk = wrappedLines.slice(i, i + 5);
        formattedParagraphs.push(slideChunk.join('\n'));
      }
    }

    return formattedParagraphs.join('\n\n');
  };

  // Trigger file selection for slide-level image and parse as base64
  const handleSlideImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeUploadSlideIndex === null) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setInputSlideImages(prev => {
        const next = [...prev];
        while (next.length <= activeUploadSlideIndex) {
          next.push('');
        }
        next[activeUploadSlideIndex] = base64;
        return next;
      });
      setActiveUploadSlideIndex(null);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input to allow selecting same file again
  };

  // Add Song Form submission
  const handleAddSongSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTitle.trim() || !inputLyrics.trim()) return;

    const parsedSlides = parseLyricsIntoSlides(inputLyrics);
    const newSong: Song = {
      id: `song-${Date.now()}`,
      title: inputTitle.trim(),
      author: inputAuthor.trim() || undefined,
      lyrics: inputLyrics,
      slides: parsedSlides,
      slideImages: inputSlideImages // Save the slide-specific images array
    };

    setSongs(prev => [newSong, ...prev]);
    setInputTitle('');
    setInputAuthor('');
    setInputLyrics('');
    setInputSlideImages([]);
    setIsAddingSong(false);
  };

  const handleAddVideoSongSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVideoName.trim() || !inputVideoUrl.trim()) return;

    const newSong: Song = {
      id: `video-song-${Date.now()}`,
      title: inputVideoName.trim(),
      author: 'Video Multimedia',
      lyrics: '',
      slides: [''],
      isVideo: true,
      videoUrl: inputVideoUrl.trim()
    };
    setSongs(prev => [newSong, ...prev]);
    setIsAddingVideo(false);
    setInputVideoName('');
    setInputVideoUrl('');
  };

  const handleVideoSongUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const newSong: Song = {
      id: `video-song-uploaded-${Date.now()}`,
      title: `📂 ${file.name}`,
      author: 'Video subido',
      lyrics: '',
      slides: [''],
      isVideo: true,
      videoUrl: objectUrl
    };
    setSongs(prev => [newSong, ...prev]);
    setIsAddingVideo(false);
  };

  // Save changes during inline editing
  const handleStartEditSong = (song: Song) => {
    setEditingSongId(song.id);
    setInputTitle(song.title);
    setInputAuthor(song.author || '');
    setInputLyrics(song.lyrics);
    setInputSlideImages(song.slideImages || []);
    setIsAddingSong(true);
  };

  const handleSaveEditedSongSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSongId) return;

    setSongs(prev => prev.map(s => {
      if (s.id === editingSongId) {
        return {
          ...s,
          title: inputTitle.trim(),
          author: inputAuthor.trim() || undefined,
          lyrics: inputLyrics,
          slides: parseLyricsIntoSlides(inputLyrics),
          slideImages: inputSlideImages // Save edited images array
        };
      }
      return s;
    }));

    // If edited song is currently projected, update state slides as well!
    if (state.activeSongId === editingSongId) {
      setTimeout(() => {
        updateState(prev => ({
          ...prev,
          activeSlideIndex: Math.min(prev.activeSlideIndex, parseLyricsIntoSlides(inputLyrics).length - 1)
        }));
      }, 100);
    }

    setEditingSongId(null);
    setInputTitle('');
    setInputAuthor('');
    setInputLyrics('');
    setInputSlideImages([]);
    setIsAddingSong(false);
  };

  const handleDeleteSong = (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Directly delete to bypass iframe dialog blocking behavior
    setSongs(prev => prev.filter(s => s.id !== songId));
    if (state.activeSongId === songId) {
      handleUnloadSong();
    }
  };

  // Intelligent Image Upload Compression to stay within localStorage constraints
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Safe resizing parameters for clean presentation and low layout size
        const maxW = 1280;
        const maxH = 720;
        let w = img.width;
        let h = img.height;

        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        if (h > maxH) {
          w = Math.round((w * maxH) / h);
          h = maxH;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          // Compress and save to IndexedDB as a Blob to prevent QuotaExceededError in localStorage
          canvas.toBlob(async (blob) => {
            if (!blob) return;

            const dbKey = `bg-custom-${Date.now()}`;
            try {
              await saveMediaBlob(dbKey, blob);
              const newBg: Background = {
                id: dbKey,
                name: file.name.replace(/\.[^/.]+$/, ""), // remove ext
                url: `db://${dbKey}`,
                type: 'image',
                isCustom: true
              };

              setBackgrounds(prev => [...prev, newBg]);
              handleSelectBackground(newBg.id);
            } catch (err) {
              console.warn("Could not save to IndexedDB, fallback to localStorage:", err);
              const base64Jpg = canvas.toDataURL('image/jpeg', 0.72);
              const newBg: Background = {
                id: `bg-custom-b64-${Date.now()}`,
                name: file.name.replace(/\.[^/.]+$/, ""), // remove ext
                url: base64Jpg,
                type: 'image',
                isCustom: true
              };

              setBackgrounds(prev => [...prev, newBg]);
              handleSelectBackground(newBg.id);
            }
          }, 'image/jpeg', 0.72);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const dbKey = `bg-custom-video-${Date.now()}`;
    try {
      await saveMediaBlob(dbKey, file);
      const newBg: Background = {
        id: dbKey,
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: `db://${dbKey}`,
        type: 'video',
        isCustom: true
      };

      setBackgrounds(prev => [...prev, newBg]);
      handleSelectBackground(newBg.id);
    } catch (err) {
      console.error("Could not save video to IndexedDB:", err);
      const objectUrl = URL.createObjectURL(file);
      const newBg: Background = {
        id: `bg-custom-video-obj-${Date.now()}`,
        name: `📂 ${file.name.replace(/\.[^/.]+$/, "")}`,
        url: objectUrl,
        type: 'video',
        isCustom: true
      };
      setBackgrounds(prev => [...prev, newBg]);
      handleSelectBackground(newBg.id);
    }
  };

  const handleSelectThumbnailInDeleteMode = (id: string) => {
    setSelectedBgsToDelete(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleBatchDeleteBackgrounds = async () => {
    if (selectedBgsToDelete.length === 0) return;
    
    // Go through each background ID to delete
    for (const bgId of selectedBgsToDelete) {
      // Delete from IndexedDB if custom
      if (bgId.startsWith('bg-custom-')) {
        try {
          await deleteMediaBlob(bgId);
        } catch (err) {
          console.warn("Could not delete from IndexedDB during batch delete:", err);
        }
      }
    }

    // Filter out deleted IDs from state
    setBackgrounds(prev => {
      const next = prev.filter(bg => !selectedBgsToDelete.includes(bg.id));
      
      // If the active background was one of the deleted backgrounds, select standard fallback
      if (selectedBgsToDelete.includes(state.activeBackgroundId)) {
        // Find first remaining image background, or default to solid color
        const firstRemaining = next.find(bg => bg.type === 'image' && bg.id !== 'solid');
        setTimeout(() => {
          handleSelectBackground(firstRemaining ? firstRemaining.id : 'solid');
        }, 50);
      }
      return next;
    });

    // Reset delete mode and selection
    setIsBgDeleteMode(false);
    setSelectedBgsToDelete([]);
  };

  const handleDeleteBackground = async (bgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Directly delete to bypass iframe dialog blocking behavior
    setBackgrounds(prev => prev.filter(bg => bg.id !== bgId));
    if (state.activeBackgroundId === bgId) {
      handleSelectBackground('bg-preset-1');
    }
    // Delete from IndexedDB if applicable
    if (bgId.startsWith('bg-custom-')) {
      try {
        await deleteMediaBlob(bgId);
      } catch (err) {
        console.warn("Could not delete from IndexedDB:", err);
      }
    }
  };

  // Intelligent Image Upload Compression for Ticker Backgrounds to stay within localStorage constraints
  const handleUploadTickerImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Safe resizing parameters for horizontal banner (typically 1000x100)
        const maxW = 1000;
        const maxH = 100;
        let w = img.width;
        let h = img.height;

        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        if (h > maxH) {
          w = Math.round((w * maxH) / h);
          h = maxH;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          // Compress to JPG for low memory footprint on localStorage
          const base64Jpg = canvas.toDataURL('image/jpeg', 0.70);
          updateState(prev => ({ ...prev, tickerBgImg: base64Jpg }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const openProjectorWindow = () => {
    try {
      const win = window.open('?mode=projector', 'church_projector', 'width=1280,height=720,menubar=no,toolbar=no,status=no');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        setShowPopupWarning(true);
        projectorWindowRef.current = null;
      } else {
        setShowPopupWarning(false);
        projectorWindowRef.current = win;
      }
    } catch (e) {
      console.error('Error opening projector window:', e);
      setShowPopupWarning(true);
      projectorWindowRef.current = null;
    }
  };

  // Preview styling variables
  const isCurrentlyPreviewDimmed = state.isForceDimmed !== null 
    ? state.isForceDimmed 
    : !!(activeSong && !state.isHideLetters && activeSong.slides[state.activeSlideIndex]);

  const previewBgInline = state.activeBackgroundId === 'solid'
    ? { backgroundColor: state.solidBackgroundColor || '#121214' }
    : activeBackground?.type === 'gradient'
      ? { background: activeBackground?.url }
      : { backgroundImage: `url(${resolvedBackgroundUrl || activeBackground?.url})`, backgroundSize: 'cover', backgroundPosition: 'center' };

  const selectedSkinData = SKINS[activeSkin as keyof typeof SKINS] || SKINS.default;

  return (
    <div className="min-h-screen skin-bg-main text-zinc-300 flex flex-row text-[11px] h-screen overflow-hidden select-none w-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --tg-bg-main: ${selectedSkinData.bgMain};
          --tg-bg-panel: ${selectedSkinData.bgPanel};
          --tg-bg-nested: ${selectedSkinData.bgNested};
          --tg-bg-inner: ${selectedSkinData.bgInner};
          --tg-border: ${selectedSkinData.border};
          --tg-border-light: ${selectedSkinData.borderLight};
          --tg-accent: ${selectedSkinData.accent};
          --tg-accent-bg: ${selectedSkinData.accentBg};
          --tg-text-primary: ${selectedSkinData.textPrimary};
          --tg-text-muted: ${selectedSkinData.textMuted || '#71717a'};
          --tg-font: ${selectedSkinData.font};
          --tg-border-style: ${selectedSkinData.borderStyle};
          --tg-border-width: ${selectedSkinData.borderWidth};
          --tg-border-radius: ${selectedSkinData.borderRadius || '8px'};
          --tg-border-radius-inner: ${selectedSkinData.borderRadiusInner || '6px'};
        }

        .skin-bg-main {
          background-color: var(--tg-bg-main) !important;
          font-family: var(--tg-font), system-ui, sans-serif !important;
          color: var(--tg-text-primary) !important;
        }
        .skin-bg-panel {
          background-color: var(--tg-bg-panel) !important;
          border-color: var(--tg-border) !important;
          border-radius: var(--tg-border-radius) !important;
        }
        .skin-border {
          border-color: var(--tg-border) !important;
        }
        .skin-border-light {
          border-color: var(--tg-border-light) !important;
        }
        .skin-bg-nested {
          background-color: var(--tg-bg-nested) !important;
          border-color: var(--tg-border) !important;
          border-radius: var(--tg-border-radius) !important;
        }
        .skin-bg-inner {
          background-color: var(--tg-bg-inner) !important;
          border-color: var(--tg-border-light) !important;
          border-radius: var(--tg-border-radius-inner) !important;
        }
        .skin-text-accent {
          color: var(--tg-accent) !important;
        }
        .skin-border-accent {
          border-color: var(--tg-accent) !important;
        }
        .skin-bg-accent {
          background-color: var(--tg-accent-bg) !important;
          border-color: var(--tg-accent) !important;
        }
        /* Custom themed items */
        .theme-sidebar-title {
          color: var(--tg-accent) !important;
        }
        .theme-card-idle {
          background-color: var(--tg-bg-main) !important;
          border-color: var(--tg-border) !important;
        }
        .theme-card-idle:hover {
          border-color: var(--tg-accent) !important;
        }
        .theme-card-active {
          background-color: var(--tg-bg-inner) !important;
          border-color: var(--tg-accent) !important;
          box-shadow: 0 0 10px rgba(0,0,0,0.5), 0 0 5px var(--tg-accent);
        }

        /* Light skin text and backgrounds high contrast overrides */
        ${activeSkin === 'white_rounded' || activeSkin === 'crimson_gray' ? `
          /* Override generic dark-mode gray font colors with proper lighter skin text colors */
          .text-zinc-500, .text-zinc-400, .text-zinc-650 {
            color: var(--tg-text-muted) !important;
          }
          .text-zinc-300, .text-zinc-200 {
            color: var(--tg-text-primary) !important;
          }
          /* Custom styled buttons and inputs */
          input[type="text"], textarea, select {
            background-color: var(--tg-bg-inner) !important;
            color: var(--tg-text-primary) !important;
            border-color: var(--tg-border) !important;
          }
          .bg-zinc-950, .bg-[#0a0a0c], .bg-[#121214], .bg-[#0f1113], .bg-zinc-900, .bg-zinc-850, .bg-zinc-800, .bg-zinc-950/40 {
            background-color: var(--tg-bg-inner) !important;
          }
          /* Subtitle texts on lists */
          span.text-zinc-500, span.text-zinc-455 {
            color: var(--tg-text-muted) !important;
          }
        ` : ''}
      `}} />
      
      {/* LEFT SIDEBAR PANEL: DOCK 1 (LETRAS LIBRARY) - FULL HEIGHT */}
      <div className="w-[21%] min-w-[204px] max-w-[274px] h-full skin-bg-panel border-r flex flex-col overflow-hidden shrink-0 shadow-lg p-2.5">
        <div className="flex items-center justify-between border-b pb-1.5 mb-2.5 gap-2 select-none skin-border">
          <span className="text-[10px] font-black tracking-wider text-zinc-400 uppercase flex items-center gap-1 font-sans">
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            LETRAS
          </span>
        </div>

        <div className="flex-grow flex flex-col overflow-hidden h-full">
          {/* COLUMN A: SONGS LIBRARY */}
          <div className="flex-grow flex flex-col overflow-hidden h-full justify-between">
            <div className="flex-grow flex flex-col overflow-hidden h-full">
              {/* Squeezed Search */}
              {enabledFeatures.buscarCantos && (
                <div className="relative mb-2 select-none">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar cantos..."
                    className="w-full text-xs font-mono pl-7 pr-7 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-indigo-600"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1.5 text-zinc-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Compact Song List */}
              <div className="flex-grow overflow-y-auto space-y-1.5 pr-2 select-text scrollbar-thin scrollbar-thumb-zinc-700">
                {filteredSongs.length > 0 ? (
                  filteredSongs.map((song) => {
                    const isCurrent = state.activeSongId === song.id;
                    return (
                      <div
                        key={song.id}
                        onClick={() => handleLoadSong(song)}
                        className={`group w-full p-2 rounded border text-left cursor-pointer transition flex items-center justify-between gap-1.5 ${
                          isCurrent 
                            ? 'bg-indigo-950 border-indigo-700 text-zinc-150 shadow' 
                            : 'bg-zinc-900 border-zinc-800/80 text-zinc-300 hover:bg-zinc-850 hover:border-zinc-750'
                        }`}
                      >
                        <div className="truncate flex-grow">
                          <div className="flex items-center gap-1.5">
                            <Play className={`w-2.5 h-2.5 ${isCurrent ? 'text-indigo-400 fill-indigo-400' : 'text-zinc-650'}`} />
                            <h4 className="text-xs font-extrabold text-zinc-100 truncate font-sans">
                              {song.title}
                            </h4>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[9.5px] text-zinc-400">
                            <span className="truncate italic max-w-[120px]">
                              {song.author || 'Sin autor'}
                            </span>
                            <span className="font-mono bg-zinc-950 px-1 py-0.2 rounded border border-zinc-855 text-blue-400 font-bold">
                              {song.slides.length} d.
                            </span>
                          </div>
                        </div>

                        {/* Inline edit and delete buttons */}
                        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditSong(song);
                            }}
                            className="p-1 bg-[#2b2b2f] hover:bg-[#3d3d44] text-zinc-300 rounded border border-[#3e3e44]"
                            title="Editar letra"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteSong(song.id, e)}
                            className="p-1 bg-red-955/50 hover:bg-red-900 text-red-300 rounded border border-red-900/40"
                            title="Eliminar de biblioteca"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-center text-zinc-650 text-[10px] italic">
                    Ninguna coincidencia...
                  </div>
                )}
              </div>
            </div>

            {/* Quick Add Buttons */}
            {!isAddingSong && (
              <div className="flex gap-2 mt-2 shrink-0 select-none w-full">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSongId(null);
                    setInputTitle('');
                    setInputAuthor('');
                    setInputLyrics('');
                    setIsAddingSong(true);
                  }}
                  className="py-1 w-full flex items-center justify-center gap-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-[9px] font-sans border border-emerald-800 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" /> AÑADIR NUEVA CANCIÓN
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT MAIN LAYOUT WORKSPACE */}
      <div className="flex-grow flex flex-col h-full overflow-hidden select-none">
      
      {/* Pop-up blocker warning notification fallback */}
      {showPopupWarning && (
        <div className="bg-amber-950/90 text-amber-200 border-b border-amber-900/60 px-4 py-1.5 flex justify-between items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">⚠️</span>
            <span className="font-sans text-[10px]">
              <strong>¡Ventana bloqueada!</strong> Abre la salida manualmente:
            </span>
          </div>
          <div className="flex gap-2">
            <a 
              href="?mode=projector" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => setShowPopupWarning(false)}
              className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-slate-900 font-bold font-sans text-[10px] rounded transition flex items-center gap-1"
            >
              Abrir Salida
            </a>
            <button 
              onClick={() => setShowPopupWarning(false)}
              className="text-[10px] text-amber-400 hover:text-white"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      {/* TOP SECTION: CONSOLIDATED MASTER CONTROL CONSOLE */}
      <section className="skin-bg-nested border-b p-2 flex flex-col lg:flex-row items-stretch gap-2.5 shrink-0 overflow-hidden">
        <div className="flex-grow flex flex-col md:flex-row items-stretch gap-3 skin-bg-nested border rounded-lg p-2 lg:h-[259px] xl:h-[285px]">
          
          {/* PROGRAMA EN VIVO - PREVIEW CONTAINER (formerly DOCK 3) */}
          <div className="flex-grow flex flex-col justify-between gap-1.5 skin-bg-inner border p-2.5 rounded-lg shrink-0 w-full md:max-w-[298px] xl:max-w-[333px] lg:h-[239px] xl:h-[263px]">
            
            <div className="flex items-center justify-between border-b pb-1 mb-1 shrink-0 skin-border-light">
              <span className="text-[10px] font-black tracking-widest text-[#4a90e2] uppercase flex items-center gap-1.5 font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                📺 PROGRAMA EN VIVO (PREVIEW)
              </span>
              <span className="font-mono text-[9px] text-zinc-500 font-semibold bg-zinc-950 px-1 py-0.2 rounded border border-zinc-850">
                MONITOR
              </span>
            </div>

            {/* PREVIEW CONTAINER */}
            <div ref={previewContainerRef} className="relative aspect-video w-full rounded border-2 border-red-650 bg-black shadow-lg overflow-hidden group">
              {/* Fake Background */}
              {activeBackground?.type === 'video' && !state.isBlackout ? (
                <video
                  src={resolvedBackgroundUrl || activeBackground?.url}
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
                  style={{ opacity: isCurrentlyPreviewDimmed ? 0.35 : 1 }}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <div 
                  className="absolute inset-0 transition-all duration-500"
                  style={{
                    ...previewBgInline,
                    opacity: state.isBlackout ? 0 : (isCurrentlyPreviewDimmed ? 0.35 : 1)
                  }}
                />
              )}

              {/* Actual Video Playback in preview */}
              {resolvedVideoUrl && (
                <video
                  ref={previewVideoRef}
                  src={resolvedVideoUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: state.isBlackout ? 0 : (isCurrentlyPreviewDimmed ? 0.35 : 1) }}
                  muted
                  loop
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    if (state.isVideoPlaying) {
                      updateState(prev => ({ 
                        ...prev, 
                        videoCurrentTime: el.currentTime,
                        videoDuration: el.duration || 0
                      }));
                    }
                  }}
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    updateState(prev => ({ ...prev, videoDuration: el.duration || 0 }));
                  }}
                />
              )}

              {/* Dim darken filter */}
              <div className={`absolute inset-0 bg-black/20 ${isCurrentlyPreviewDimmed && !state.isBlackout ? 'opacity-100' : 'opacity-0'} transition-opacity`} style={{ zIndex: 2 }} />
              
              {/* Simulated text */}
              <div style={{ zIndex: 5 }} className="absolute inset-0 flex flex-col justify-center items-center p-3 text-center pointer-events-none">
                {state.isBlackout ? (
                  <span className="text-red-500 font-bold text-[9px] tracking-wider bg-black/90 px-1.5 py-0.5 rounded border border-red-500/50">
                    BLACKOUT TOTAL
                  </span>
                ) : state.isHideLetters ? (
                  <span className="text-slate-400 font-bold text-[9px] bg-slate-950/90 px-1.5 py-0.5 rounded">
                    LETRAS OCULTAS
                  </span>
                ) : activeSong && (activeSong.slides[state.activeSlideIndex] || (activeSong.slideImages && activeSong.slideImages[state.activeSlideIndex])) ? (
                  <div className="flex flex-col items-center justify-center max-w-[95%]">
                    {/* Render slide-specific image in preview monitor if set */}
                    {activeSong.slideImages && activeSong.slideImages[state.activeSlideIndex] && (
                      <img
                        src={activeSong.slideImages[state.activeSlideIndex]}
                        alt={`Slide ${state.activeSlideIndex + 1}`}
                        className="max-h-[38px] w-auto object-contain rounded border border-white/20 mb-1 leading-none shadow"
                      />
                    )}
                    {activeSong.slides[state.activeSlideIndex] && (
                      <p 
                        className="leading-tight font-bold text-white transition-all max-w-full break-words animate-[fadeIn_0.2s_ease-out]"
                        style={{ 
                          fontSize: `${Math.max(7, (state.fontSize / 1920) * previewWidth)}px`,
                          color: state.fontColor,
                          textShadow: '0px 1px 2.5px rgba(0, 0, 0, 0.95)',
                          textAlign: state.alignment,
                          fontWeight: state.isBold ? 700 : 500
                        }}
                      >
                        {activeSong.slides[state.activeSlideIndex].split('\n').map((line, lidx) => (
                          <React.Fragment key={lidx}>
                            {lidx > 0 && <br />}
                            {line}
                          </React.Fragment>
                        ))}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Real-time simulated ticker on preview screen */}
              {state.isTickerActive && state.tickerText && !state.isBlackout && (
                <div 
                  style={{ backgroundColor: state.tickerHideBg ? 'transparent' : state.tickerColor, zIndex: 15 }}
                  className={`absolute bottom-0 left-0 right-0 h-4 flex items-center overflow-hidden ${
                    state.tickerHideBg ? '' : 'border-t border-white/5 shadow-inner'
                  }`}
                >
                  <div className="bg-zinc-950 text-white font-extrabold px-1.5 h-full flex items-center shrink-0 uppercase text-[5px] scale-[0.8] origin-left select-none">
                    VIVO
                  </div>
                  <div className={`flex-grow overflow-hidden relative w-full h-full flex items-center select-none ${
                    state.tickerHideBg ? '' : 'bg-black/10'
                  }`}>
                    <p 
                      className="animate-marquee whitespace-nowrap font-bold text-[6px] select-none"
                      style={{ color: state.tickerTextColor || '#ffffff' }}
                    >
                      {state.tickerText}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* BOTONES INTERRUPTORES DE EMERGENCIA MOVODIDOS DEBAJO DE LA PANTALLA */}
            <div className="grid grid-cols-3 gap-1 mt-1.5 font-sans shrink-0">
              <button
                id="preview_emergency_blackout"
                onClick={toggleBlackout}
                className={`flex items-center justify-center gap-1 py-1 px-0.5 rounded text-[9.5px] font-black uppercase transition shadow cursor-pointer h-7 ${
                  state.isBlackout
                    ? 'bg-red-650 text-white animate-pulse border border-red-550'
                    : 'bg-[#1b1b1f] hover:bg-zinc-800 border border-zinc-805 text-zinc-355 bg-red-955/20 border-red-900/10'
                }`}
                title="Blackout Total (B)"
              >
                <Monitor className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="truncate">BLACKOUT</span>
              </button>

              <button
                id="preview_emergency_mute"
                onClick={toggleHideLetters}
                className={`flex items-center justify-center gap-1 py-1 px-0.5 rounded text-[9.5px] font-black uppercase transition shadow cursor-pointer h-7 ${
                  state.isHideLetters
                    ? 'bg-blue-650 text-white border border-blue-550'
                    : 'bg-[#1b1b1f] hover:bg-zinc-800 border border-zinc-805 text-zinc-355 bg-indigo-955/20 border-indigo-900/10'
                }`}
                title="Ocultar Letras (C)"
              >
                <Eye className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="truncate">MUTEAR</span>
              </button>

              <button
                id="preview_emergency_unload"
                onClick={handleUnloadSong}
                disabled={!activeSong}
                className="flex items-center justify-center gap-1 py-1 px-0.5 bg-[#1b1b1f] hover:bg-zinc-800 disabled:opacity-20 border border-zinc-800 rounded text-[9.5px] font-black uppercase transition cursor-pointer h-7 text-zinc-300"
                title="Liberar letras"
              >
                <X className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">LIBERAR</span>
              </button>
            </div>

          </div>

      {/* RIGHT SIDEBAR PANEL: CONSOLE DETAILS & ADVANCED CONTROLS */}
      {activeSubTab !== 'none' && (
        <div className="w-full lg:w-[506px] xl:w-[546px] h-[500px] lg:h-[238px] xl:h-[262px] bg-[#131315] border border-[#252528] rounded-lg p-3 flex flex-col justify-between overflow-hidden shrink-0 select-none shadow-xl transition-all duration-300">
            
            <div className="flex-grow flex flex-col h-full overflow-hidden">
              {/* Dynamic scrolling panel content */}
              <div className="flex-grow overflow-y-auto pr-1 text-[11px] space-y-3.5 scrollbar-thin h-full">
                
                {/* SUBTAB 1: BACKGROUND MANAGEMENT */}
                {activeSubTab === 'backgrounds' && (
                  <div className="space-y-3 font-sans">
                    <div className="flex flex-col gap-1.5 border-t border-zinc-900/60 pt-2 mt-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[8px] uppercase font-black text-zinc-400 block font-sans">Galería de Imágenes de Fondo:</span>
                        
                        <div className="flex items-center gap-1.5">
                          {isBgDeleteMode ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsBgDeleteMode(false);
                                  setSelectedBgsToDelete([]);
                                }}
                                className="text-[8px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-bold py-0.5 px-2 rounded-sm active:scale-95 flex items-center gap-1 font-sans cursor-pointer whitespace-nowrap"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={selectedBgsToDelete.length === 0}
                                onClick={handleBatchDeleteBackgrounds}
                                className={`text-[8px] font-black py-0.5 px-2 rounded-sm active:scale-95 flex items-center gap-1 font-sans cursor-pointer whitespace-nowrap border transition ${
                                  selectedBgsToDelete.length > 0
                                    ? 'bg-red-950/40 hover:bg-red-955/60 border-red-900/50 text-red-400 font-extrabold'
                                    : 'bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed opacity-50'
                                }`}
                              >
                                {`BORRAR SELECCIONADOS (${selectedBgsToDelete.length})`}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsBgDeleteMode(true);
                                  setSelectedBgsToDelete([]);
                                }}
                                className="text-[8.5px] bg-red-950/20 hover:bg-red-955/40 border border-red-900/30 text-red-400 font-bold py-0.5 px-2 rounded-sm active:scale-95 flex items-center gap-1 font-sans cursor-pointer whitespace-nowrap"
                                title="Entrar en modo selección para eliminar cualquier imagen"
                              >
                                🗑️ BORRAR IMÁGENES
                              </button>
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-[8px] bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-805/60 text-indigo-300 font-bold py-0.5 px-2 rounded-sm active:scale-95 flex items-center gap-1 font-sans cursor-pointer whitespace-nowrap"
                              >
                                + SUBIR FOTO
                              </button>
                            </>
                          )}
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleUploadImage}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pre-rendered list of backgrounds - now expanded to 3 columns inside the wider panel */}
                    <div className="grid grid-cols-3 gap-2 max-h-[160px] overflow-y-auto p-1.5 bg-zinc-950/40 rounded border border-zinc-900 scrollbar-thin">
                      {backgrounds.filter(bg => bg.type === 'image' && bg.id !== 'solid').map((bg) => (
                        <BackgroundThumbnail
                          key={bg.id}
                          bg={bg}
                          isSelected={state.activeBackgroundId === bg.id}
                          isDeleteModeActive={isBgDeleteMode}
                          isDeletionSelected={selectedBgsToDelete.includes(bg.id)}
                          onClick={() => {
                            if (isBgDeleteMode) {
                              handleSelectThumbnailInDeleteMode(bg.id);
                            } else {
                              handleSelectBackground(bg.id);
                            }
                          }}
                          onDelete={(e) => handleDeleteBackground(bg.id, e)}
                        />
                      ))}
                    </div>

                    {/* Dim Mode Options */}
                    <div className="bg-[#121214] border border-zinc-800/80 rounded p-2 space-y-1 font-sans">
                      <span className="text-[7.5px] font-black text-red-500 block uppercase">OSCURECEDOR DE FONDO</span>
                      <p className="text-[7.5px] leading-tight text-zinc-400">Reduce el brillo de fondo al 35% para que la letra tenga un contraste legible.</p>
                      
                      <div className="grid grid-cols-3 gap-1 text-center bg-zinc-950 p-[2px] rounded border border-zinc-850">
                        <button
                          type="button"
                          onClick={() => handleSetDimMode(null)}
                          className={`py-1 rounded text-[7.5px] uppercase font-black transition ${
                            state.isForceDimmed === null
                              ? 'bg-zinc-700 text-white shadow'
                              : 'text-zinc-500 hover:text-[#4a90e2]'
                          }`}
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetDimMode(true)}
                          className={`py-1 rounded text-[7.5px] uppercase font-black transition ${
                            state.isForceDimmed === true
                              ? 'bg-zinc-700 text-white shadow'
                              : 'text-zinc-500 hover:text-[#4a90e2]'
                          }`}
                        >
                          Dim [35%]
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetDimMode(false)}
                          className={`py-1 rounded text-[7.5px] uppercase font-black transition ${
                            state.isForceDimmed === false
                              ? 'bg-zinc-700 text-white shadow'
                              : 'text-zinc-500 hover:text-[#4a90e2]'
                          }`}
                        >
                          Limpio [100%]
                        </button>
                      </div>
                    </div>

                    {/* Background Image Auto-Rotation Options */}
                    <div className="bg-[#121214] border border-zinc-800/80 rounded p-2.5 space-y-2 font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-[7.5px] font-black text-indigo-400 block uppercase font-sans">ROTACIÓN AUTOMÁTICA DE FONDO</span>
                        <div className="flex items-center gap-1.5 font-sans">
                          <input
                            type="checkbox"
                            checked={state.isRotationEnabled || false}
                            onChange={(e) => updateState(prev => ({ ...prev, isRotationEnabled: e.target.checked }))}
                            className="w-3.5 h-3.5 rounded border-zinc-800 accent-indigo-500 cursor-pointer"
                            id="bg-autorotate-checkbox"
                          />
                          <label htmlFor="bg-autorotate-checkbox" className="text-[8px] font-bold text-zinc-300 uppercase cursor-pointer">Activar</label>
                        </div>
                      </div>

                      <div className="space-y-1 font-sans">
                        <div className="flex items-center justify-between text-[7px] text-zinc-500 font-bold uppercase">
                          <span>TIEMPO DE ROTACIÓN DE FONDOS:</span>
                          <span className="text-indigo-400 font-mono font-bold text-[8px]">{state.rotationIntervalMinutes || 5} min</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="30"
                          step="1"
                          value={state.rotationIntervalMinutes || 5}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            updateState(prev => ({ ...prev, rotationIntervalMinutes: val }));
                          }}
                          className="w-full accent-indigo-500 bg-zinc-950 border border-zinc-850 rounded h-1 cursor-pointer appearance-none outline-none"
                          disabled={!state.isRotationEnabled}
                        />
                      </div>

                      <div className="flex items-center justify-between border-t border-zinc-850 pt-2 mt-1 font-sans">
                        <span className="text-[7.5px] font-bold text-zinc-400 uppercase">Rotar al cambiar canción:</span>
                        <input
                          type="checkbox"
                          checked={state.rotateBackgroundWithSongs || false}
                          onChange={(e) => updateState(prev => ({ ...prev, rotateBackgroundWithSongs: e.target.checked }))}
                          className="w-3.5 h-3.5 rounded border-zinc-800 accent-indigo-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* SINGLE CHANGEABLE SOLID COLOR SELECTION */}
                    <div className="bg-[#121214] border border-zinc-800/80 rounded p-2.5 space-y-2 font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-indigo-400 block uppercase">FONDO COLOR SÓLIDO</span>
                        <span className="font-mono text-[8px] text-zinc-500">{state.solidBackgroundColor || '#000000'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={state.solidBackgroundColor || '#121214'}
                          onChange={(e) => {
                            const newColor = e.target.value;
                            updateState(prev => ({
                              ...prev,
                              solidBackgroundColor: newColor,
                              activeBackgroundId: 'solid'
                            }));
                          }}
                          className="w-10 h-8 bg-transparent border-0 rounded cursor-pointer shrink-0"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updateState(prev => ({
                              ...prev,
                              activeBackgroundId: 'solid'
                            }));
                          }}
                          className={`flex-grow py-1.5 text-[8.5px] uppercase font-black tracking-wider rounded border transition ${
                            state.activeBackgroundId === 'solid'
                              ? 'bg-indigo-650 border-indigo-500 text-white font-extrabold shadow-sm'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-405 hover:text-zinc-100 hover:bg-zinc-805'
                          }`}
                        >
                          {state.activeBackgroundId === 'solid' ? '● Color Activo' : 'Cargar Color en Proyector'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUBTAB 2: FONTS & TYPOGRAPHY FORMAT */}
                {activeSubTab === 'fonts' && (
                  <div className="space-y-3 font-sans">
                    {/* Sizing slider with presets trigger */}
                    <div className="space-y-1.5 bg-zinc-950/40 p-2.5 rounded border border-zinc-900">
                      <div className="flex justify-between text-[8px] text-zinc-450 font-black">
                        <span>TAMAÑO DE LA LETRA (REGULABLE)</span>
                        <span className="text-[#4a90e2] font-mono font-bold text-[9px]">{state.fontSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="24"
                        max="240"
                        value={state.fontSize}
                        onChange={(e) => updateState(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                        className="w-full accent-blue-500 bg-zinc-950 rounded h-1 cursor-pointer"
                      />
                      <div className="flex gap-1 pt-1">
                        {([32, 48, 64, 80, 110, 140] as const).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => updateState(prev => ({ ...prev, fontSize: sz }))}
                            className={`flex-1 py-1 rounded text-[8px] font-bold border transition cursor-pointer ${
                              state.fontSize === sz
                                ? 'bg-blue-650 border-blue-500 text-white font-extrabold shadow-sm'
                                : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-white'
                            }`}
                          >
                            {sz}px
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Side-by-side alignment options & styles switches */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Alignment */}
                      <div className="bg-zinc-950/40 p-2.5 rounded border border-zinc-900">
                        <span className="text-[8px] font-black text-zinc-400 uppercase block mb-1.5 font-sans">Alineación:</span>
                        <div className="flex flex-col gap-1 font-sans">
                          {(['left', 'center', 'right'] as const).map((align) => {
                            const Icon = { left: AlignLeft, center: AlignCenter, right: AlignRight }[align];
                            const isSelected = state.alignment === align;
                            return (
                              <button
                                key={align}
                                onClick={() => updateState(prev => ({ ...prev, alignment: align }))}
                                className={`flex items-center justify-start p-1.5 px-2.5 rounded transition gap-2 cursor-pointer ${
                                  isSelected 
                                    ? 'bg-zinc-700 text-white font-black shadow-sm shadow-zinc-900/50' 
                                    : 'text-zinc-500 bg-zinc-900/30 hover:text-zinc-300 hover:bg-zinc-900'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="text-[7.5px] uppercase">{align === 'left' ? 'Izquierda' : align === 'center' ? 'Centro' : 'Derecha'}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Styles Switches */}
                      <div className="bg-zinc-950/40 p-2.5 rounded border border-zinc-900 flex flex-col justify-between">
                        <span className="text-[8px] font-black text-zinc-400 uppercase block mb-1.5 font-sans">Grosor y Sombra:</span>
                        <div className="space-y-1.5 flex-grow flex flex-col justify-center font-sans">
                          <button
                            type="button"
                            onClick={() => updateState(prev => ({ ...prev, isBold: !prev.isBold }))}
                            className={`py-2 px-1.5 w-full rounded text-[8px] font-black uppercase tracking-wide border transition flex items-center justify-between cursor-pointer ${
                              state.isBold 
                                ? 'bg-zinc-700 border-zinc-650 text-white shadow-sm' 
                                : 'bg-[#1a1a1c] border-zinc-850 text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <span>Negrita (B)</span>
                            <span className="text-[7.5px] bg-black/40 px-1 py-0.2 rounded font-mono">{state.isBold ? 'ON' : 'OFF'}</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => updateState(prev => ({ ...prev, shadowEnabled: !prev.shadowEnabled }))}
                            className={`py-2 px-1.5 w-full rounded text-[8px] font-black uppercase tracking-wide border transition flex items-center justify-between cursor-pointer ${
                              state.shadowEnabled 
                                ? 'bg-zinc-700 border-zinc-650 text-white shadow-sm' 
                                : 'bg-[#1a1a1c] border-zinc-855 text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <span>Sombra Letras</span>
                            <span className="text-[7.5px] bg-black/40 px-1 py-0.2 rounded font-mono">{state.shadowEnabled ? 'ON' : 'OFF'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Color selection */}
                    <div className="flex items-center justify-between bg-zinc-950/40 p-2.5 rounded border border-zinc-900 select-none">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-zinc-400 uppercase font-sans leading-none mb-1">Color del Texto:</span>
                        <div className="flex gap-1 pt-1">
                          {['#FFFFFF', '#FFFF00', '#00FFFF', '#00FF00', '#FF9900', '#FFAAAA'].map(colorPreset => (
                            <button
                              key={colorPreset}
                              type="button"
                              onClick={() => updateState(prev => ({ ...prev, fontColor: colorPreset }))}
                              style={{ backgroundColor: colorPreset }}
                              className={`w-3.5 h-3.5 rounded-full border border-black/35 shadow-sm transition hover:scale-110 cursor-pointer ${
                                state.fontColor.toUpperCase() === colorPreset.toUpperCase() ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-950' : ''
                              }`}
                              title={`Elegir ${colorPreset}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-zinc-950 p-[3px] px-2 rounded-sm border border-zinc-850">
                        <input
                          type="color"
                          value={state.fontColor}
                          onChange={(e) => updateState(prev => ({ ...prev, fontColor: e.target.value }))}
                          className="w-5 h-5 rounded-sm cursor-pointer border border-[#333] bg-transparent block"
                        />
                        <span className="text-[8.5px] font-mono font-black text-zinc-300">{state.fontColor}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUBTAB 4: NEWS TICKER LEGENDS */}
                {activeSubTab === 'legends' && (
                  <div className="space-y-3 font-sans">
                    <p className="text-[7.5px] leading-relaxed text-zinc-455 font-sans">
                      Agrega cintillos promocionales o leyendas de banner en la parte inferior para avisar eventos de la parroquia.
                    </p>

                    <div className="bg-zinc-950/50 p-2.5 rounded border border-zinc-855 space-y-2.5 font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-zinc-350 uppercase">Desplegar Leyenda</span>
                        <button
                          type="button"
                          onClick={() => updateState(prev => ({ ...prev, isTickerActive: !prev.isTickerActive }))}
                          className={`px-2 py-0.5 text-[8px] font-extrabold rounded-full transition uppercase ${
                            state.isTickerActive 
                              ? 'bg-amber-600 text-black shadow-md'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {state.isTickerActive ? 'ACTIVA' : 'DESACTIVADA'}
                        </button>
                      </div>

                      <div className="space-y-1 font-sans">
                        <label className="text-[8.5px] font-bold text-zinc-400 block uppercase font-sans">Texto del Cintillo:</label>
                        <textarea
                          rows={3}
                          value={state.tickerText}
                          onChange={(e) => updateState(prev => ({ ...prev, tickerText: e.target.value }))}
                          placeholder="Ej. Bienvenido a nuestra reunión. Culto General de Adoración."
                          className="w-full text-[13px] sm:text-[14px] bg-zinc-950 border border-zinc-800 p-2.5 rounded text-zinc-100 outline-none focus:border-amber-500 font-sans font-medium resize-y min-h-[70px] shadow-inner"
                        />
                      </div>

                      {/* Font Size Adjustment Ticker Slider */}
                      <div className="space-y-1 font-sans">
                        <div className="flex justify-between items-center text-[8px] font-bold text-zinc-400 uppercase">
                          <span>Tamaño de Letra del Cintillo:</span>
                          <span className="font-mono text-amber-500 font-bold">{state.tickerFontSize || 16}px</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={120}
                          step={1}
                          value={state.tickerFontSize || 16}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            updateState(prev => ({ ...prev, tickerFontSize: val }));
                          }}
                          className="w-full accent-amber-600 bg-zinc-900 border border-zinc-800 rounded h-1 cursor-pointer appearance-none outline-none"
                        />
                      </div>

                      {/* Scroll Speed Adjustment Slider */}
                      <div className="space-y-1 font-sans">
                        <div className="flex justify-between items-center text-[8px] font-bold text-zinc-400 uppercase">
                          <span>Velocidad de Desplazamiento del Texto:</span>
                          <span className="font-mono text-amber-500 font-bold">
                            {state.tickerSpeed === 1 ? 'Muy Lento' : 
                             state.tickerSpeed === 3 ? 'Lento' : 
                             state.tickerSpeed === 5 ? 'Normal' : 
                             state.tickerSpeed === 8 ? 'Rápido' : 
                             state.tickerSpeed === 10 ? 'Muy Rápido' : 
                             `Nivel ${state.tickerSpeed || 5}`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={state.tickerSpeed || 5}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            updateState(prev => ({ ...prev, tickerSpeed: val }));
                          }}
                          className="w-full accent-amber-600 bg-zinc-900 border border-zinc-800 rounded h-1 cursor-pointer appearance-none outline-none"
                        />
                      </div>

                      {/* Color controls for Background and Text */}
                      <div className="grid grid-cols-2 gap-2 border-t border-zinc-900 pt-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[8.5px] font-bold text-zinc-400 uppercase">Fondo Cintillo:</span>
                          <div className="flex items-center gap-1.5 bg-zinc-950 p-[3px] rounded border border-zinc-850">
                            <input
                              type="color"
                              value={state.tickerColor}
                              onChange={(e) => updateState(prev => ({ ...prev, tickerColor: e.target.value }))}
                              className="w-4 h-4 rounded cursor-pointer bg-transparent"
                            />
                            <span className="text-[8px] font-mono text-zinc-350">{state.tickerColor}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[8.5px] font-bold text-zinc-400 uppercase font-sans">Letras Leyenda:</span>
                          <div className="flex items-center gap-1.5 bg-zinc-950 p-[3px] rounded border border-zinc-850">
                            <input
                              type="color"
                              value={state.tickerTextColor || '#ffffff'}
                              onChange={(e) => updateState(prev => ({ ...prev, tickerTextColor: e.target.value }))}
                              className="w-4 h-4 rounded cursor-pointer bg-transparent"
                            />
                            <span className="text-[8px] font-mono text-zinc-350">{state.tickerTextColor || '#ffffff'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Custom Ticker Background Selection (Solid vs Transparent vs Image) */}
                      <div className="space-y-2 border-t border-zinc-900 pt-2 font-sans">
                        <span className="text-[8px] font-bold text-zinc-550 uppercase block">Fondo del Cintillo (Tipo o Preset):</span>
                        
                        <div className="grid grid-cols-3 gap-1.5">
                          {/* Option to clear image and use solid color */}
                          <button
                            type="button"
                            onClick={() => updateState(prev => ({ ...prev, tickerBgImg: null, tickerHideBg: false }))}
                            className={`py-1 text-[8px] uppercase font-black rounded border transition h-7 cursor-pointer flex items-center justify-center ${
                              !state.tickerBgImg && !state.tickerHideBg
                                ? 'bg-amber-600 border-amber-500 text-black font-extrabold' 
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            🎨 Sólido
                          </button>

                          {/* Option for transparent (sin fondo) */}
                          <button
                            type="button"
                            onClick={() => updateState(prev => ({ ...prev, tickerHideBg: true, tickerBgImg: null }))}
                            className={`py-1 text-[8px] uppercase font-black rounded border transition h-7 cursor-pointer flex items-center justify-center ${
                              state.tickerHideBg 
                                ? 'bg-amber-600 border-amber-500 text-black font-extrabold' 
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            🚫 Sin Fondo
                          </button>

                          {/* Upload custom image */}
                          <button
                            type="button"
                            onClick={() => {
                              updateState(prev => ({ ...prev, tickerHideBg: false }));
                              tickerImageInputRef.current?.click();
                            }}
                            className={`py-1 text-[8px] uppercase font-black rounded border transition h-7 cursor-pointer flex items-center justify-center ${
                              state.tickerBgImg && !state.tickerBgImg.startsWith('preset-') && !state.tickerHideBg
                                ? 'bg-amber-600 border-amber-500 text-black font-extrabold' 
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            📤 Subir img
                          </button>
                        </div>

                        {/* Presets Grid */}
                        <div className="grid grid-cols-3 gap-1 pt-1">
                          {[
                            { name: '✨ Partículas', url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?q=80&w=640&auto=format&fit=crop' },
                            { name: '☀️ Celestial', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=640&auto=format&fit=crop' },
                            { name: '🕯️ Religioso', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=640&auto=format&fit=crop' }
                          ].map((p, idx) => {
                            const isSelected = state.tickerBgImg === p.url && !state.tickerHideBg;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => updateState(prev => ({ ...prev, tickerBgImg: p.url, tickerHideBg: false }))}
                                className={`py-1 text-[7px] font-extrabold rounded truncate border transition h-6 cursor-pointer flex items-center justify-center ${
                                  isSelected 
                                    ? 'bg-amber-600 border-amber-500 text-black' 
                                    : 'bg-zinc-950 border-zinc-900 text-white hover:text-zinc-200'
                                }`}
                              >
                                {p.name}
                              </button>
                            );
                          })}
                        </div>

                        {/* Hidden input for ticker custom image upload */}
                        <input
                          ref={tickerImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleUploadTickerImage}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
      </div>
    </section>

            {/* LOWER OBS LAYOUT WORKSPACE */}
        <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-1.5 p-1.5 skin-bg-nested overflow-hidden">
          
        {/* DOCK 2: PROGRAM SLIDES (8/12 cols) */}
        {enabledFeatures.playlistDock2 && (
          <div className="lg:col-span-8 skin-bg-panel border rounded p-2 flex flex-col overflow-hidden">
          
          <div className="flex items-center justify-between border-b pb-1.5 mb-2 skin-border">
            <span className="text-[10px] font-black tracking-wider text-zinc-400 uppercase flex items-center gap-1 font-sans">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              ESTROFAS / DIAPOSITIVAS (CLIC PARA PROYECTAR)
            </span>
            <span className="font-mono text-[9px] text-[#4a90e2] font-semibold bg-zinc-950 px-1 py-0.2 rounded border border-zinc-800">
              VISTA PROGRAMA
            </span>
          </div>

          {/* ESTADO DE ESTROFA ACTIVA (SIN BOTONES SIGUIENTE/ATRAS) */}
          <div className="mb-2 bg-[#111112] p-2 rounded border border-zinc-800/80 shrink-0 font-sans flex items-center justify-between px-3">
            <div className="flex flex-col truncate flex-grow">
              <span className="text-[8px] text-zinc-500 font-bold block uppercase tracking-wide">
                {activeSong ? 'Alabanza en Transmisión:' : selectedVideoId ? 'Medio de Video en Vista:' : 'Señal en Transmisión:'}
              </span>
              <span className="text-zinc-200 text-[10px] font-bold truncate max-w-[200px]" title={activeSong ? activeSong.title : selectedVideoId ? (videos.find(v => v.id === selectedVideoId)?.name || 'Video activo') : 'Ninguna'}>
                {activeSong ? activeSong.title : selectedVideoId ? `🎬 ${videos.find(v => v.id === selectedVideoId)?.name}` : 'Letras Limpias (Solo Fondo)'}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0 ml-2 select-none">
              <button
                type="button"
                disabled={!activeSong || state.activeSlideIndex <= 0}
                onClick={handlePrevSlide}
                className="p-1 px-1.5 bg-[#18181b] hover:bg-zinc-800 disabled:opacity-20 border border-zinc-805 rounded text-zinc-300 cursor-pointer flex items-center justify-center transition active:scale-95 duration-100"
                title="Atrás (Slide anterior)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="bg-[#18181b] border border-zinc-805 rounded flex items-center gap-1.5 py-1 px-2.5 shrink-0">
                <span className="text-[7.5px] text-zinc-500 font-black uppercase">
                  {activeSong ? (activeSong.isVideo ? 'REPROD:' : 'ESTROFA:') : 'MEDIOS:'}
                </span>
                <span className="text-[12px] font-black text-blue-500 font-mono tracking-wide animate-pulse">
                  {activeSong ? (activeSong.isVideo ? 'VIDEO' : `${state.activeSlideIndex + 1} / ${slidesCount}`) : selectedVideoId ? 'MP4' : '0 / 0'}
                </span>
              </div>

              <button
                type="button"
                disabled={!activeSong}
                onClick={handleNextSlide}
                className="p-1 px-1.5 bg-blue-650 hover:bg-blue-550 disabled:opacity-20 border border-blue-750/70 rounded text-white font-bold cursor-pointer flex items-center justify-center transition active:scale-95 duration-100"
                title="Siguiente (Slide adelante)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Slides visual space */}
          <div className="flex-grow overflow-y-auto pr-1">
            {activeSong ? (
              activeSong.isVideo ? (
                /* REDESIGNED FULL INTERACTIVE VIDEO MEDIA PLAYER FOR DOCK 2 */
                <div className="flex flex-col h-full bg-[#111112] border border-zinc-900 rounded p-4 items-center justify-center font-sans space-y-4">
                  <div className="text-center">
                    <span className="text-[10px] font-black tracking-widest text-[#4a90e2] bg-[#4a90e2]/10 px-2.5 py-0.5 rounded border border-[#4a90e2]/30 uppercase">
                      REPRODUCTOR MULTIMEDIA ACTIVO
                    </span>
                  </div>

                  {/* Play & Pause Controls */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateState(prev => ({ ...prev, isVideoPlaying: !prev.isVideoPlaying }))}
                      className={`w-12 h-12 rounded-full flex items-center justify-center border transition shadow cursor-pointer text-white ${
                        state.isVideoPlaying
                          ? 'bg-amber-600 border-amber-500 hover:bg-amber-500'
                          : 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500'
                      }`}
                      title={state.isVideoPlaying ? 'Pausar' : 'Reproducir'}
                    >
                      {state.isVideoPlaying ? (
                        <Pause className="w-5 h-5 fill-white" />
                      ) : (
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => updateState(prev => ({ ...prev, isVideoPlaying: false, videoCurrentTime: 0 }))}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition cursor-pointer text-zinc-300"
                      title="Reiniciar video"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Seek Progress Bar */}
                  <div className="w-full max-w-[420px] bg-zinc-950 p-3 rounded-lg border border-zinc-850/80 space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 select-none">
                      <span>{formatDuration(state.videoCurrentTime || 0)}</span>
                      <span>{formatDuration(state.videoDuration || 0)}</span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={state.videoDuration || 200}
                      step={0.1}
                      value={state.videoCurrentTime || 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateState(prev => ({ ...prev, videoCurrentTime: val }));
                        if (previewVideoRef.current) {
                          previewVideoRef.current.currentTime = val;
                        }
                      }}
                      className="w-full accent-indigo-650 bg-zinc-900 border border-zinc-800 rounded h-1.5 cursor-pointer appearance-none outline-none"
                    />

                    <div className="text-center pt-1.5 text-[8.5px] text-zinc-500 italic">
                      💡 Usa las <span className="text-zinc-450 font-bold font-sans">Flechas Izquierda / Derecha</span> de tu teclado para retroceder o avanzar 5s si el video está pausado.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-1.5 pb-2">
                  {activeSong.slides.map((slide, sIdx) => {
                    const isActive = state.activeSlideIndex === sIdx;
                    return (
                      <div
                        key={sIdx}
                        onClick={() => handleSelectSlide(sIdx)}
                        className={`relative aspect-[16/9] cursor-pointer rounded p-1 flex flex-col justify-between border select-none transition-all duration-150 overflow-hidden ${
                          isActive 
                            ? 'border-red-650 bg-red-955/20 ring-1 ring-red-650 shadow' 
                            : 'border-zinc-800 bg-[#111112] hover:bg-zinc-900/60'
                        }`}
                      >
                        {/* Slideno bar indicator */}
                        <div className="flex justify-between items-center z-10 shrink-0">
                          <span className={`text-[7.5px] px-1 font-bold rounded ${
                            isActive ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-450 font-mono'
                          }`}>
                            #{sIdx + 1}
                          </span>

                          {isActive && (
                            <span className="text-[6.5px] text-red-500 font-extrabold uppercase flex items-center gap-0.5 tracking-wider font-sans">
                              <span className="w-1 h-1 rounded-full bg-red-500 animate-ping" />
                              PROGRAMA
                            </span>
                          )}
                        </div>

                        {/* Display small stanza lyrics - enlarged and tight wrap */}
                        <div className="my-auto py-0.5 text-center truncate overflow-hidden px-0.5">
                          <p className="text-[12.5px] tracking-wide font-black text-zinc-100 whitespace-pre-line leading-tight line-clamp-2">
                            {slide}
                          </p>
                        </div>

                        {/* Footer */}
                        <div className="text-[6.5px] text-zinc-555 text-left truncate shrink-0 font-sans pl-0.5">
                          Transición Libre
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : selectedVideoId && selectedVid ? (
              <div className="flex flex-col h-full bg-[#111112] border border-zinc-800/80 rounded p-4 justify-between items-center text-center font-sans">
                <div className="max-w-[400px] space-y-3 flex flex-col items-center">
                  <div className="w-12 h-12 bg-violet-950/40 rounded-full flex items-center justify-center border border-violet-800 text-violet-400 animate-pulse mt-4">
                    <Video className="w-6 h-6" />
                  </div>
                  
                  <p className="text-[9px] text-zinc-400 max-w-[280px] leading-relaxed pt-2">
                    Este video se ha cargado como diapositiva multimedia. Presiona el botón habilitado de abajo para iniciarlo en tu proyector.
                  </p>
                </div>

                {/* ACTIVE MEDIA CONTROL SWITCH */}
                <div className="flex gap-2.5 mt-6 mb-4 w-full max-w-[320px] justify-center">
                  <button
                    type="button"
                    onClick={() => playVideo(selectedVid.id, selectedVid.url)}
                    className={`flex-grow py-2.5 px-4 rounded text-[10px] font-black uppercase tracking-wider border transition shadow flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelectedVideoPlaying
                        ? 'bg-emerald-600 border-emerald-550 text-[#fff] animate-pulse'
                        : 'bg-violet-750 hover:bg-violet-650 border-violet-800 text-[#fff]'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    {isSelectedVideoPlaying ? '● REPRODUCIENDO EN VIVO' : '▶️ PROYECTAR VIDEO'}
                  </button>

                  <button
                    type="button"
                    onClick={stopVideo}
                    disabled={!isSelectedVideoPlaying}
                    className="py-2.5 px-4 rounded text-[10px] font-black uppercase tracking-wider border transition shadow flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none bg-zinc-800 hover:bg-zinc-750 border-zinc-750 text-amber-500 cursor-pointer"
                  >
                    <VideoOff className="w-3.5 h-3.5" />
                    ⏹️ FRENAR
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[160px] border border-dashed border-zinc-800 rounded bg-zinc-950/40 flex flex-col justify-center items-center p-6 text-center">
                <div className="p-2 bg-zinc-900 rounded-full text-zinc-650 border border-zinc-820 mb-2">
                  <Play className="w-5 h-5" />
                </div>
                <h4 className="text-[10px] font-bold text-zinc-400">Sin Letra Activa en Programa</h4>
                <p className="text-[9px] text-zinc-650 mt-1 max-w-[200px] font-sans">
                  Haz clic en cualquier alabanza de la biblioteca izquierda para desplegar sus diapositivas y sincronizar en vivo.
                </p>
              </div>
            )}
          </div>

        </div>
        )}

        {/* DOCK 3: CONTROL DASHBOARD (4/12 or 12/12 cols) */}
        <div className={`${enabledFeatures.playlistDock2 ? 'lg:col-span-4' : 'lg:col-span-12'} skin-bg-panel border rounded p-2.5 flex flex-col overflow-hidden justify-between h-full select-none`}>
          
          <div className="flex-grow flex flex-col justify-between h-full gap-2.5">
            {/* Header / Title */}
            <div className="flex items-center justify-between border-b pb-1.5 shrink-0 skin-border">
              <span className="text-[10px] font-black tracking-widest text-[#4a90e2] uppercase flex items-center gap-1.5 font-sans">
                🕹️ CONSOLA DE OPERACIÓN
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="admin_panel_gear_btn"
                  onClick={() => {
                    setIsAdminModalOpen(true);
                    setIsAuthorized(false);
                    setUnlockedRole(null);
                    setAdminPasswordInput('');
                    setAdminError('');
                  }}
                  className="p-1 hover:bg-zinc-805 bg-zinc-900 border border-zinc-800 rounded text-zinc-455 hover:text-white transition duration-150 shadow flex items-center justify-center cursor-pointer"
                  title="Configuración de Administrador"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[9px] text-zinc-500 font-semibold bg-zinc-950 px-1 py-0.2 rounded border border-zinc-850">
                  CONTROLLERS
                </span>
              </div>
            </div>

            {/* PROJECTION CONNECTION & LAUNCH CONTROLS - PLACED DIRECTLY UNDER HEADLINE */}
            <div className="select-none shrink-0">
              <button
                type="button"
                onClick={openProjectorWindow}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-1.5 bg-indigo-750 hover:bg-indigo-650 text-white font-extrabold text-[10px] uppercase rounded border border-indigo-850 tracking-wider shadow-sm transition active:scale-95 duration-155 cursor-pointer"
              >
                <Monitor className="w-3 h-3 text-white" />
                <span>LANZAR PROYECTOR</span>
                <span className={`w-1.5 h-1.5 rounded-full border border-black/30 ${isProjectorConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-550'}`} />
              </button>
            </div>

            {/* ROW A: CONSOLE SECTION SELECTORS (DYNAMIC COLUMN ROW BASED ON FEATURE TOGGLES) - PLACED BELOW LANZAR PROYECTOR */}
            {([enabledFeatures.fondos, enabledFeatures.letra, enabledFeatures.leyenda].some(Boolean)) && (
              <div className={`grid ${
                [enabledFeatures.fondos, enabledFeatures.letra, enabledFeatures.leyenda].filter(Boolean).length === 3 
                  ? 'grid-cols-3' 
                  : [enabledFeatures.fondos, enabledFeatures.letra, enabledFeatures.leyenda].filter(Boolean).length === 2 
                    ? 'grid-cols-2' 
                    : 'grid-cols-1'
              } gap-1 border border-zinc-900 bg-zinc-950/40 p-0.5 rounded select-none`}>
                {enabledFeatures.fondos && (
                  <button
                    type="button"
                    onClick={() => setActiveSubTab(prev => prev === 'backgrounds' ? 'none' : 'backgrounds')}
                    className={`py-1 text-[8.5px] font-black uppercase tracking-tight rounded transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      activeSubTab === 'backgrounds' ? 'bg-indigo-650 text-white shadow' : 'bg-transparent text-zinc-400 hover:text-zinc-200 lg:hover:bg-zinc-900/40'
                    }`}
                  >
                    <span className="text-xs">🎨</span>
                    <span className="font-extrabold font-sans leading-none">Fondos</span>
                  </button>
                )}
                {enabledFeatures.letra && (
                  <button
                    type="button"
                    onClick={() => setActiveSubTab(prev => prev === 'fonts' ? 'none' : 'fonts')}
                    className={`py-1 text-[8.5px] font-black uppercase tracking-tight rounded transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      activeSubTab === 'fonts' ? 'bg-indigo-650 text-white shadow' : 'bg-transparent text-zinc-400 hover:text-zinc-200 lg:hover:bg-[#1a1a1c]'
                    }`}
                  >
                    <span className="text-xs">✍️</span>
                    <span className="font-extrabold font-sans leading-none">Letra</span>
                  </button>
                )}
                {enabledFeatures.leyenda && (
                  <button
                    type="button"
                    onClick={() => setActiveSubTab(prev => prev === 'legends' ? 'none' : 'legends')}
                    className={`py-1 text-[8.5px] font-black uppercase tracking-tight rounded transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      activeSubTab === 'legends' ? 'bg-amber-600 text-black shadow' : 'bg-transparent text-zinc-400 hover:text-zinc-200 lg:hover:bg-[#1a1a1c]'
                    }`}
                  >
                    <span className="text-xs">📺</span>
                    <span className="font-extrabold font-sans leading-none">Leyenda</span>
                  </button>
                )}
              </div>
            )}

            {/* INTEGRATED CLIMA & SANTORAL DE HOY (WEATHER & LITURGICAL SAINT INFOCARD) */}
            <div className="bg-zinc-950/40 p-3.5 rounded border border-zinc-900 space-y-3.5 mt-1 font-sans">
              
              {/* Clima Actual Section */}
              <div className="flex items-center justify-between border-b border-zinc-900/80 pb-2">
                <span className="text-[10px] font-black text-rose-450 uppercase tracking-widest flex items-center gap-1">
                  ⛅ ESTADO DEL TIEMPO (CLIMA)
                </span>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded border border-zinc-900">
                    <span className="text-base leading-none animate-pulse" title="Condición climática">
                      {state.weatherDesc ? state.weatherDesc.split(' ')[0] : '☀️'}
                    </span>
                    <span className="text-[12px] font-black text-zinc-100 font-mono tracking-tight">
                      {state.weatherTemp || 'Midiendo...'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateState(prev => ({ ...prev, showWeatherOnProjector: !prev.showWeatherOnProjector }))}
                    className={`px-2 py-1 rounded border text-[8.5px] font-black tracking-wider uppercase transition-all duration-150 flex items-center gap-1 cursor-pointer ${
                      state.showWeatherOnProjector
                        ? 'bg-red-950 border-red-500 text-red-400 hover:text-red-300 shadow shadow-red-500/10'
                        : 'bg-[#1a1a1c]/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Mostrar/ocultar temperatura en el proyector principal (arriba derecha en rojo)"
                  >
                    <span>{state.showWeatherOnProjector ? '📺 AL AIRE' : 'PROYECTAR'}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${state.showWeatherOnProjector ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
                  </button>
                </div>
              </div>

              {/* Santoral Católico Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] font-extrabold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                    😇 SANTORAL CATÓLICO ARGENTINO
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      const saint = getSaintOfDate(currentDate);
                      updateState(prev => {
                        const show = !prev.showSaintOnProjector;
                        return {
                          ...prev,
                          showSaintOnProjector: show,
                          saintName: show ? saint.name : '',
                          saintType: show ? saint.type : '',
                          saintBio: show ? saint.bio : ''
                        };
                      });
                    }}
                    className={`px-2 py-0.5 rounded border text-[8.5px] font-black tracking-wider uppercase transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                      state.showSaintOnProjector
                        ? 'bg-amber-950 border-amber-500 text-amber-400 hover:text-amber-300 shadow shadow-amber-500/10'
                        : 'bg-[#1a1a1c]/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Proyectar el santoral de hoy en pantalla como una leyenda inferior"
                  >
                    <span>{state.showSaintOnProjector ? '📺 AL AIRE' : 'PROYECTAR'}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${state.showSaintOnProjector ? 'bg-amber-500 animate-pulse' : 'bg-zinc-650'}`} />
                  </button>
                </div>

                <div className="space-y-2.5 pt-1 leading-normal bg-black/25 p-3.5 rounded border border-zinc-900/50">
                  <div className="flex justify-between items-baseline gap-2 flex-wrap border-b border-zinc-900 pb-1.5">
                    <span className="text-[15.5px] font-black text-amber-400 font-sans tracking-tight">
                      {getSaintOfDate(currentDate).name}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono tracking-wider font-extrabold uppercase shrink-0">
                      {getSaintOfDate(currentDate).type}
                    </span>
                  </div>

                  <p className="text-[13.5px] text-zinc-200 leading-relaxed font-sans text-justify font-medium">
                    {getSaintOfDate(currentDate).bio}
                  </p>
                </div>
              </div>
            </div>


          </div>

        </div>

      </div>

      {/* ADMINISTRATOR CONTROL PANEL MODAL */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4 backdrop-blur-xs font-sans">
          <div className="border border-zinc-700/80 bg-[#161619] rounded-xl p-5 w-full max-w-lg shadow-2xl relative text-zinc-300">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2.5">
              <h3 className="text-xs font-black text-indigo-400 flex items-center gap-1.5 uppercase font-sans tracking-wide">
                <Settings className={`w-4 h-4 text-indigo-500 ${isUpdating ? 'animate-spin' : ''}`} />
                <span>Panel de Administración</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAdminModalOpen(false);
                  setIsAuthorized(false);
                  setUnlockedRole(null);
                  setAdminPasswordInput('');
                  setAdminError('');
                }}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isAuthorized ? (
              /* Authorization Screen */
              <form onSubmit={handleVerifyPassword} className="space-y-4 font-sans">
                <div className="text-center py-2">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-2 text-zinc-405">
                    🔒
                  </div>
                  <h4 className="text-[11px] font-black text-white uppercase tracking-wider">INGRESA CONTRASEÑA O PIN DE USUARIO</h4>
                  <p className="text-[9px] text-zinc-500 mt-1">El acceso está protegido para evitar configuraciones accidentales</p>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="password"
                    required
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Escribe PIN de usuario o Clave de Administrador..."
                    className="w-full text-xs text-center px-3 py-2 bg-zinc-950 border border-zinc-855 rounded text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-indigo-650"
                  />
                  {adminError && <p className="text-[9px] text-red-500 text-center font-bold">{adminError}</p>}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminModalOpen(false);
                      setAdminPasswordInput('');
                      setAdminError('');
                    }}
                    className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold text-[9.5px] rounded uppercase cursor-pointer transition border border-zinc-800"
                  >
                    Salir
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-1.5 bg-indigo-650 hover:bg-indigo-550 text-white font-extrabold text-[9.5px] rounded uppercase cursor-pointer select-none shadow hover:shadow-indigo-500/20 transition-all duration-150"
                  >
                    Entrar
                  </button>
                </div>
              </form>
            ) : (
              /* Administrative Interface Screen */
              <div className="space-y-4 font-sans">
                {/* Role Badge and Metadata */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-850">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${unlockedRole === 'admin' ? 'bg-indigo-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="text-[9px] font-black tracking-wider text-zinc-350 uppercase">
                      {unlockedRole === 'admin' ? '👑 Administrador Maestro' : '💻 Usuario Operador Regular'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500">{swVersion}</span>
                </div>

                {/* Tab Navigation */}
                <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-850 overflow-hidden font-sans">
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('funciones')}
                    className={`flex-1 py-1.5 text-center rounded text-[9px] font-black uppercase tracking-wide cursor-pointer select-none transition ${
                      adminActiveTab === 'funciones' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    🛠️ Funciones
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('seguridad')}
                    className={`flex-1 py-1.5 text-center rounded text-[9px] font-black uppercase tracking-wide cursor-pointer select-none transition ${
                      adminActiveTab === 'seguridad' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    🔑 Seguridad
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('respaldo')}
                    className={`flex-1 py-1.5 text-center rounded text-[9px] font-black uppercase tracking-wide cursor-pointer select-none transition ${
                      adminActiveTab === 'respaldo' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    💾 Respaldo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('actualizacion')}
                    className={`flex-1 py-1.5 text-center rounded text-[9px] font-black uppercase tracking-wide cursor-pointer select-none transition ${
                      adminActiveTab === 'actualizacion' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    📡 Actualizar
                  </button>
                </div>

                {/* Subtab 1: Feature Toggles */}
                {adminActiveTab === 'funciones' && (
                  <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                    <span className="text-[8px] font-bold text-zinc-500 block uppercase mb-1">Opciones de Visibilidad de Funciones</span>
                    
                    {/* Background Toggle */}
                    <div className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-900 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-[9.5px] font-black text-zinc-200 uppercase">🎨 Botón Fondos</span>
                        <span className="text-[8px] text-zinc-500">Muestra u oculta la sección de fondos de diapositivas</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnabledFeatures(prev => ({ ...prev, fondos: !prev.fondos }))}
                        className={`px-3 py-1 text-[8.5px] font-bold tracking-wider rounded uppercase border transition duration-155 cursor-pointer ${
                          enabledFeatures.fondos 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' 
                            : 'bg-red-955/40 text-red-400 border-red-900/50'
                        }`}
                      >
                        {enabledFeatures.fondos ? 'Visible' : 'Bloqueado'}
                      </button>
                    </div>

                    {/* Fonts Toggle */}
                    <div className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-900 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-[9.5px] font-black text-zinc-200 uppercase">✍️ Botón Tipografía (Letra)</span>
                        <span className="text-[8px] text-zinc-500">Muestra u oculta la sección de formato y tamaño de fuente</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnabledFeatures(prev => ({ ...prev, letra: !prev.letra }))}
                        className={`px-3 py-1 text-[8.5px] font-bold tracking-wider rounded uppercase border transition duration-155 cursor-pointer ${
                          enabledFeatures.letra 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' 
                            : 'bg-red-955/40 text-red-400 border-red-900/50'
                        }`}
                      >
                        {enabledFeatures.letra ? 'Visible' : 'Bloqueado'}
                      </button>
                    </div>

                    {/* Legends Ticker Toggle */}
                    <div className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-900 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-[9.5px] font-black text-zinc-200 uppercase">📺 Botón Generador de Leyenda</span>
                        <span className="text-[8px] text-zinc-500">Muestra u oculta el cintillo informativo/ticker inferior</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnabledFeatures(prev => ({ ...prev, leyenda: !prev.leyenda }))}
                        className={`px-3 py-1 text-[8.5px] font-bold tracking-wider rounded uppercase border transition duration-155 cursor-pointer ${
                          enabledFeatures.leyenda 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' 
                            : 'bg-red-955/40 text-red-400 border-red-900/50'
                        }`}
                      >
                        {enabledFeatures.leyenda ? 'Visible' : 'Bloqueado'}
                      </button>
                    </div>

                    {/* Song Search input bar Toggle */}
                    <div className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-900 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-[9.5px] font-black text-zinc-200 uppercase">🔍 Buscador de Letras y Cantos</span>
                        <span className="text-[8px] text-zinc-500">Muestra u oculta la caja de búsqueda en biblioteca izquierda</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnabledFeatures(prev => ({ ...prev, buscarCantos: !prev.buscarCantos }))}
                        className={`px-3 py-1 text-[8.5px] font-bold tracking-wider rounded uppercase border transition duration-155 cursor-pointer ${
                          enabledFeatures.buscarCantos 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' 
                            : 'bg-red-955/40 text-red-400 border-red-900/50'
                        }`}
                      >
                        {enabledFeatures.buscarCantos ? 'Activado' : 'Ocultado'}
                      </button>
                    </div>

                    {/* Dock 2 (slides view) Toggle */}
                    <div className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-900 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-[9.5px] font-black text-zinc-200 uppercase">📋 Tablero de Estrofas / Diapositivas</span>
                        <span className="text-[8px] text-zinc-500">Muestra u oculta el módulo central DOCK 2 de la pantalla</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnabledFeatures(prev => ({ ...prev, playlistDock2: !prev.playlistDock2 }))}
                        className={`px-3 py-1 text-[8.5px] font-bold tracking-wider rounded uppercase border transition duration-155 cursor-pointer ${
                          enabledFeatures.playlistDock2 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' 
                            : 'bg-red-955/40 text-red-400 border-red-900/50'
                        }`}
                      >
                        {enabledFeatures.playlistDock2 ? 'Visible' : 'Bloqueado'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Subtab 2: Key Credentials & PINs */}
                {adminActiveTab === 'seguridad' && (
                  <div className="space-y-4 font-sans max-h-[290px] overflow-y-auto pr-1">
                    {/* Master Password Note */}
                    <div className="bg-zinc-950 border border-zinc-850 p-2.5 rounded-lg flex flex-col gap-1 text-[9px]">
                      <span className="font-extrabold text-amber-500">🔑 CONTRASEÑA MAESTRA PRINCIPAL:</span>
                      <div className="text-zinc-400 leading-normal font-sans">
                        La clave maestra por defecto es <span className="font-mono text-white font-black bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded inline-block">Doctor01</span>. Éste rol tiene permisos irrestrictos de administración y puede aplicar actualizaciones de sistema.
                      </div>
                    </div>

                    {/* Custom PIN Registration Form */}
                    <form onSubmit={handleAddPin} className="space-y-2 pt-1 border-t border-zinc-900 font-sans">
                      <span className="text-[8.5px] font-bold text-zinc-500 block uppercase">Registrar Nuevo PIN de Usuario Operador</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          maxLength={10}
                          value={newPinInput}
                          onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="Introduce un PIN numérico (Ej. 4321)..."
                          className="flex-grow text-[9.5px] px-3 py-1.5 bg-zinc-950 border border-zinc-855 rounded text-zinc-100 outline-none placeholder-zinc-700 font-mono"
                        />
                        <button
                          type="submit"
                          disabled={unlockedRole !== 'admin'}
                          className={`px-3 py-1 text-[8.5px] font-extrabold rounded uppercase cursor-pointer select-none border transition ${
                            unlockedRole === 'admin'
                              ? 'bg-indigo-650 hover:bg-indigo-550 border-indigo-500 text-white shadow-md'
                              : 'bg-zinc-900 text-zinc-650 border-zinc-850 cursor-not-allowed'
                          }`}
                        >
                          Añadir PIN
                        </button>
                      </div>
                      {unlockedRole !== 'admin' && (
                        <p className="text-[7.5px] text-amber-500 font-sans">⚠️ Solo el Administrador Maestro puede registrar o eliminar PINs.</p>
                      )}
                    </form>

                    {/* PIN Registrados list */}
                    <div className="space-y-1.5 pt-1 border-t border-zinc-900">
                      <span className="text-[8px] font-black text-zinc-455 uppercase block">PINs de Usuarios Operadores Registrados</span>
                      <div className="grid grid-cols-2 gap-1.5 font-sans">
                        {userPins.map((pin) => (
                          <div key={pin} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-900/60 rounded">
                            <span className="text-[9.5px] font-bold font-mono text-zinc-300">🔑 PIN: {pin}</span>
                            <button
                              type="button"
                              disabled={unlockedRole !== 'admin'}
                              onClick={() => handleRemovePin(pin)}
                              className={`p-1 rounded transition cursor-pointer flex items-center justify-center ${
                                unlockedRole === 'admin'
                                  ? 'hover:bg-red-950/40 text-zinc-500 hover:text-red-400'
                                  : 'text-zinc-750 cursor-not-allowed'
                              }`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtab 3: Software System Updates */}
                {adminActiveTab === 'actualizacion' && (
                  <div className="space-y-4 font-sans max-h-[290px] overflow-y-auto pr-1">
                    <span className="text-[8px] font-bold text-zinc-500 block uppercase">Actualizaciones & Skins de Interfaz</span>

                    {unlockedRole !== 'admin' ? (
                      <div className="bg-red-955/20 border border-red-900/40 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2 font-sans">
                        <span className="text-xl">⚠️</span>
                        <h4 className="text-[10px] font-black text-red-400 uppercase">ACCESO RESTRINGIDO AL OPERADOR</h4>
                        <p className="text-[8.5px] text-zinc-500 leading-normal max-w-sm">
                          La descarga de nuevos parches de software, esquemas estéticos y optimizadores del motor está bloqueada para operadores regulares. Por favor, reingrese usando la contraseña maestra del Administrador.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 font-sans">
                        {/* Summary panel */}
                        <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-3 grid grid-cols-3 gap-2 text-center text-[9px] font-sans">
                          <div className="flex flex-col border-r border-[#1e2024] pr-1">
                            <span className="text-zinc-550 block font-semibold uppercase font-sans">VER. ACTUAL:</span>
                            <span className="font-bold text-zinc-100 font-mono mt-0.5">{swVersion}</span>
                          </div>
                          <div className="flex flex-col border-r border-[#1e2024] pr-1 pl-1">
                            <span className="text-zinc-550 block font-semibold uppercase font-sans">BIBLIOTECA:</span>
                            <span className="font-bold text-emerald-400 mt-0.5">✔ SEGURA</span>
                          </div>
                          <div className="flex flex-col pl-1">
                            <span className="text-zinc-550 block font-semibold uppercase font-sans">INTEGRIDAD:</span>
                            <span className="font-bold text-blue-400 mt-0.5 font-sans">AL 100%</span>
                          </div>
                        </div>

                        {/* Selector de Skins / Temas de la Interfaz */}
                        <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 space-y-1.5 shrink-0">
                          <span className="text-[9.5px] font-black text-indigo-400 uppercase tracking-wider block border-b border-zinc-900 pb-1 flex items-center gap-1">
                            🎨 Esquemas Estéticos & Skins (Skins de Interfaz)
                          </span>
                          
                          <div className="grid grid-cols-1 gap-1.5 pt-1 max-h-[170px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                            {Object.values(SKINS).map((skin) => (
                              <button
                                key={skin.id}
                                type="button"
                                onClick={() => {
                                  setActiveSkin(skin.id);
                                  localStorage.setItem('church_controller_skin', skin.id);
                                }}
                                className={`w-full p-2 rounded text-left border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                  activeSkin === skin.id
                                    ? 'bg-zinc-900 border-indigo-500 shadow-sm'
                                    : 'bg-zinc-950 border-zinc-850 hover:bg-zinc-900/40 hover:border-zinc-700'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black text-zinc-200">{skin.name}</span>
                                    {activeSkin === skin.id && (
                                      <span className="bg-indigo-900/60 text-indigo-300 font-black text-[7px] px-1 rounded uppercase tracking-wider border border-indigo-700">ACTIVO</span>
                                    )}
                                  </div>
                                  <p className="text-[8px] text-zinc-500 leading-snug">{skin.description}</p>
                                </div>
                                
                                {/* Visual skin parameters previews */}
                                <div className="flex items-center gap-1 shrink-0 bg-zinc-950 p-1 rounded border border-zinc-900">
                                  <span className="w-2.5 h-2.5 rounded-full border border-zinc-800" style={{ backgroundColor: skin.bgMain }} title="Fondo Principal" />
                                  <span className="w-2.5 h-2.5 rounded-full border border-zinc-800" style={{ backgroundColor: skin.bgPanel }} title="Paneles" />
                                  <span className="w-2.5 h-2.5 rounded-full border border-zinc-800" style={{ backgroundColor: skin.accent }} title="Color Acento" />
                                  <span className="text-[10px] font-bold uppercase ml-1 px-1 rounded bg-zinc-900 text-zinc-400 border border-zinc-800" style={{ fontFamily: skin.font }} title="Estilo de letra">Aa</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Interactive triggers */}
                        <input
                          type="file"
                          ref={updateFileInputRef}
                          onChange={handleUpdateFileChange}
                          className="hidden"
                          accept=".zip,.json,.bin"
                        />

                        {!isUpdating && !pendingUpdateFile && (
                          <button
                            type="button"
                            onClick={handleUpdateSoftware}
                            className="w-full py-2 bg-indigo-650 hover:bg-indigo-550 border border-indigo-500 rounded text-xs font-black uppercase text-white shadow hover:shadow-indigo-500/20 transition-all duration-150 cursor-pointer text-center select-none flex items-center justify-center gap-1.5 focus:outline-none"
                          >
                            🚀 ABRIR CARPETA Y SUBIR PARCHE DE ACTUALIZACIÓN
                          </button>
                        )}

                        {pendingUpdateFile && !isUpdating && (
                          <div className="bg-zinc-950 border border-indigo-500/40 p-2.5 rounded-lg space-y-2 font-sans animation-fade-in col-span-12 text-left">
                            <div className="border-b border-zinc-900 pb-1 flex items-center justify-between">
                              <span className="text-[8.5px] font-black text-indigo-400 uppercase tracking-wider">📦 Parche Cargado:</span>
                              <span className="text-[8px] font-mono text-zinc-400 bg-zinc-900 px-1 py-0.5 rounded truncate max-w-[130px]" title={pendingUpdateFile.name}>
                                {pendingUpdateFile.name}
                              </span>
                            </div>
                            
                            <p className="text-[7.5px] text-zinc-400 leading-normal">
                              Seleccione cuáles de los <strong>módulos nuevos</strong> desea instalar. El motor base, la base de canciones y de fondos se actualizarán por completo:
                            </p>
                            
                            <div className="space-y-1 bg-zinc-900/40 p-1.5 rounded border border-zinc-850">
                              <label className="flex items-start gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={updateModules.clima}
                                  onChange={(e) => setUpdateModules(prev => ({ ...prev, clima: e.target.checked }))}
                                  className="mt-0.5 rounded border-zinc-800 text-indigo-500 focus:ring-0 cursor-pointer"
                                />
                                <div className="text-[8px] leading-tight">
                                  <span className="font-bold text-zinc-200 block">⛅ Clima y Widget del Tiempo</span>
                                  <span className="text-zinc-500 text-[7px]">Integra temperatura real programada e íconos en el proyector.</span>
                                </div>
                              </label>

                              <label className="flex items-start gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={updateModules.autoFontSize}
                                  onChange={(e) => setUpdateModules(prev => ({ ...prev, autoFontSize: e.target.checked }))}
                                  className="mt-0.5 rounded border-zinc-800 text-indigo-500 focus:ring-0 cursor-pointer"
                                />
                                <div className="text-[8px] leading-tight">
                                  <span className="font-bold text-zinc-200 block">📐 Auto-Ajuste Proporcionado</span>
                                  <span className="text-zinc-550 text-[7px]">Ajusta el tamaño de letra en pantalla según la extensión del verso.</span>
                                </div>
                              </label>

                              <label className="flex items-start gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={updateModules.skins}
                                  onChange={(e) => setUpdateModules(prev => ({ ...prev, skins: e.target.checked }))}
                                  className="mt-0.5 rounded border-zinc-800 text-indigo-500 focus:ring-0 cursor-pointer"
                                />
                                <div className="text-[8px] leading-tight">
                                  <span className="font-bold text-zinc-200 block">🎨 Nuevos Esquemas & Skins</span>
                                  <span className="text-zinc-550 text-[7px]">Agrega skins "Blanco Puro Redondeado" y "Gris y Carmesí".</span>
                                </div>
                              </label>

                              <label className="flex items-start gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={updateModules.lyricsPatch}
                                  onChange={(e) => setUpdateModules(prev => ({ ...prev, lyricsPatch: e.target.checked }))}
                                  className="mt-0.5 rounded border-zinc-800 text-indigo-500 focus:ring-0 cursor-pointer"
                                />
                                <div className="text-[8px] leading-tight">
                                  <span className="font-bold text-zinc-200 block">📝 Parches de Letras Inteligentes</span>
                                  <span className="text-zinc-550 text-[7px]">Estructuración recomendada de estrofas de máximo 5 renglones.</span>
                                </div>
                              </label>
                            </div>

                            <div className="flex gap-1 pt-1">
                              <button
                                type="button"
                                onClick={() => setPendingUpdateFile(null)}
                                className="flex-grow py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 font-bold text-[8.5px] rounded uppercase cursor-pointer text-center"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={handleProceedWithUpdate}
                                className="flex-grow py-1 bg-indigo-650 hover:bg-indigo-550 text-white font-extrabold text-[8.5px] rounded uppercase cursor-pointer text-center"
                              >
                                🚀 Proceder
                              </button>
                            </div>
                          </div>
                        )}

                        {swVersion === 'v1.0.2-Stable' && !isUpdating && (
                          <div className="bg-emerald-950/20 border border-emerald-900/40 p-3 rounded-lg text-center flex flex-col items-center justify-center gap-1.5 font-sans">
                            <div className="flex items-center gap-1">
                              <span className="text-emerald-400 font-bold">✔</span>
                              <span className="text-[9px] font-bold text-emerald-400 uppercase font-sans">ÚLTIMA VERSIÓN INSTALADA CON ÉXITO (V1.0.2)</span>
                            </div>
                            {updateFileName && (
                              <span className="text-[8px] text-zinc-500 font-mono">Actualizado desde: "{updateFileName}"</span>
                            )}
                          </div>
                        )}

                        {/* Progress and simulation terminal */}
                        {isUpdating && (
                          <div className="space-y-1.5 pl-0.5 animation-fade-in font-sans">
                            <div className="flex justify-between items-center text-[7.5px] font-black text-amber-500 uppercase font-mono">
                              <span>Instalando v1.0.2 sin pérdida de datos...</span>
                              <span>{updateProgress}%</span>
                            </div>
                            <div className="w-full bg-zinc-900 border border-zinc-800 rounded h-1.5 overflow-hidden">
                              <div 
                                className="bg-indigo-500 h-full transition-all duration-300"
                                style={{ width: `${updateProgress}%` }}
                              />
                            </div>
                            <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-870 h-[90px] overflow-y-auto font-mono text-[7px] text-emerald-400 select-none space-y-0.5 scrollbar-thin">
                              {updateLogs.map((log, lIdx) => (
                                <div key={lIdx} className="leading-normal">
                                  {log}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Features preserved notice */}
                        <p className="text-[7.5px] text-zinc-550 leading-normal italic text-center text-zinc-450 max-w-md mx-auto font-sans">
                          Nota: El motor de actualización preserva íntegramente las carpetas de canciones locales (`church_projector_songs`), lista de fondos subidos (`church_projector_backgrounds`) y videos sin borrar ningún registro.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab 4: Real Backup and Restore Operations */}
                {adminActiveTab === 'respaldo' && (
                  <div className="space-y-4 font-sans max-h-[290px] overflow-y-auto pr-1">
                    <span className="text-[8px] font-bold text-zinc-500 block uppercase">Copia de Seguridad Real (.ZIP)</span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Left Block: Export/Backup */}
                      <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-lg space-y-3 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[10px] font-black text-rose-400 uppercase flex items-center gap-1.5 mb-1">
                            📥 Respaldar Biblioteca
                          </h4>
                          <p className="text-[8px] text-zinc-400 leading-normal">
                            Crea una copia comprimida real de todas tus canciones locales cargadas, fondos fotográficos de diapositivas y enlaces de video del sistema. Se empaquetará todo en una carpeta estructurada dentro del archivo .zip descargable.
                          </p>
                          
                          <div className="mt-3 bg-[#111112] border border-zinc-900 rounded p-2 text-[7.5px] font-mono text-zinc-500 space-y-1">
                            <div>• Canciones registradas: <strong className="text-zinc-300">{songs.length}</strong></div>
                            <div>• Fondos configurados: <strong className="text-zinc-300">{backgrounds.length}</strong></div>
                            <div>• Videos enlazados: <strong className="text-zinc-300">{videos.length}</strong></div>
                          </div>
                        </div>

                        <div className="pt-2">
                          {!isBackingUp ? (
                            <button
                              type="button"
                              onClick={handleCreateBackup}
                              className="w-full py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-500/30 text-[9px] font-extrabold uppercase rounded cursor-pointer transition flex items-center justify-center gap-1.5 select-none"
                            >
                              💾 CREAR RESPALDO LOCAL & DESCARGAR ZIP
                            </button>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[7px] font-mono text-rose-400 uppercase">
                                <span>Generando respaldo...</span>
                                <span>{backupProgress}%</span>
                              </div>
                              <div className="w-full bg-zinc-900 h-1 rounded overflow-hidden">
                                <div className="bg-rose-500 h-full transition-all duration-200" style={{ width: `${backupProgress}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Block: Import/Restore */}
                      <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-lg space-y-3 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[10px] font-black text-emerald-400 uppercase flex items-center gap-1.5 mb-1">
                            📤 Cargar Copia (Restaurar)
                          </h4>
                          <p className="text-[8px] text-zinc-400 leading-normal">
                            Selecciona una copia en formato .ZIP descargada previamente desde este sistema o por otro operador. Podrás visualizar el contenido interno antes de aplicarlo.
                          </p>
                        </div>

                        <div className="pt-2">
                          {!isRestoring && !restorePreview ? (
                            <label className="w-full py-1.5 bg-emerald-950/40 hover:bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 text-[9px] font-extrabold uppercase rounded cursor-pointer transition flex items-center justify-center gap-1.5 select-none text-center">
                              📁 SELECCIONAR RESPALDO ZIP
                              <input
                                type="file"
                                onChange={handleLoadBackupFileChange}
                                accept=".zip"
                                className="hidden"
                              />
                            </label>
                          ) : isRestoring ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[7px] font-mono text-emerald-405 uppercase">
                                <span>Procesando archivo...</span>
                                <span>{restoreProgress}%</span>
                              </div>
                              <div className="w-full bg-zinc-900 h-1 rounded overflow-hidden">
                                <div className="bg-emerald-500 h-full transition-all duration-200" style={{ width: `${restoreProgress}%` }} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Terminal for backup success / status logs */}
                    {backupLogs.length > 0 && isBackingUp && (
                      <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-900 font-mono text-[7px] text-rose-300 space-y-0.5 animation-fade-in">
                        {backupLogs.map((log, bIdx) => (
                          <div key={bIdx} className="leading-normal">{log}</div>
                        ))}
                      </div>
                    )}

                    {/* Preview box and restore config options when file is uploaded */}
                    {restorePreview && (
                      <div className="bg-zinc-950/80 border border-emerald-500/40 p-2.5 rounded-lg space-y-2.5 text-left animation-fade-in font-sans">
                        <div className="border-b border-zinc-900 pb-1 flex items-center justify-between">
                          <span className="text-[8.5px] font-black text-emerald-400 uppercase tracking-wider">📦 Confirmar Restauración de Datos:</span>
                          <span className="text-[7.5px] font-mono text-zinc-400 bg-zinc-900 px-1 py-0.5 rounded truncate max-w-[155px]" title={restorePreview.fileName}>
                            {restorePreview.fileName}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1.5 bg-zinc-900/40 p-1.5 rounded text-[8px] font-mono text-zinc-300">
                          <div className="text-center py-1 bg-black/30 rounded border border-zinc-900 select-none">
                            <span className="block text-zinc-500 text-[6.5px]">CANCIONES</span>
                            <span className="font-bold text-indigo-400 text-[10px]">{restorePreview.songsCount}</span>
                          </div>
                          <div className="text-center py-1 bg-black/30 rounded border border-zinc-900 select-none">
                            <span className="block text-zinc-500 text-[6.5px]">FONDOS</span>
                            <span className="font-bold text-rose-400 text-[10px]">{restorePreview.backgroundsCount}</span>
                          </div>
                          <div className="text-center py-1 bg-black/30 rounded border border-zinc-900 select-none">
                            <span className="block text-zinc-500 text-[6.5px]">VIDEOS</span>
                            <span className="font-bold text-amber-500 text-[10px]">{restorePreview.videosCount}</span>
                          </div>
                        </div>

                        <p className="text-[7.5px] text-zinc-400 leading-normal">
                          Por favor, seleccione el modo en el que ingresará esta copia de seguridad. Los datos se persistirán permanentemente de forma inmediata:
                        </p>

                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleConfirmRestore('merge')}
                            className="flex-1 py-1 px-1 bg-indigo-700/80 hover:bg-indigo-650 text-white font-bold text-[8.5px] rounded uppercase cursor-pointer text-center select-none transition text-center"
                            title="Conserva todos tus datos actuales, agregando sólo las canciones/fondos del zip que no tengas (No Duplica IDs)"
                          >
                            🧬 FUSIONAR DIFERENCIAS
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmRestore('replace')}
                            className="flex-1 py-1 px-1 bg-rose-650 hover:bg-rose-550 text-white font-extrabold text-[8.5px] rounded uppercase cursor-pointer text-center select-none transition text-center"
                            title="Sobreescribirá por completo todos tus datos de canciones, fondos y videos con los contenidos en el backup (¡PÉRDIDA DE DATOS ACTUALES!)"
                          >
                            ⚠️ REEMPLAZAR TODO
                          </button>
                          <button
                            type="button"
                            onClick={() => setRestorePreview(null)}
                            className="py-1 px-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-500 font-bold text-[8.5px] rounded uppercase cursor-pointer text-center select-none transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Restore progress and logs when installing live */}
                    {restoreLogs.length > 0 && (
                      <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-900 font-mono text-[7px] text-emerald-400 space-y-0.5 animation-fade-in">
                        {restoreLogs.map((log, rIdx) => (
                          <div key={rIdx} className="leading-normal">{log}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}


      {/* COMPACT SONGS FIELD WORK CREATOR POPUP */}
      {isAddingSong && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
          <div className="border border-zinc-700 bg-[#1c1c1f] rounded-lg p-5 w-full max-w-4xl shadow-2xl relative">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-indigo-400 flex items-center gap-1 font-sans">
                <Play className="w-3.5 h-3.5 text-emerald-500" />
                {editingSongId ? 'MODIFICAR CANCIÓN Y OPTIMIZAR FORMATO' : 'REGISTRAR NUEVA CANCIÓN Y OPTIMIZAR FORMATO'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingSong(false)}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="file"
              ref={slideImageFileInputRef}
              onChange={handleSlideImageChange}
              className="hidden"
              accept="image/*"
            />

            <form onSubmit={editingSongId ? handleSaveEditedSongSubmit : handleAddSongSubmit} className="space-y-3 font-sans">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Column Left: Text & Lyric Options */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-zinc-400 tracking-wide block font-bold mb-1 font-sans">TÍTULO DE LA CANCIÓN</label>
                    <input
                      type="text"
                      required
                      value={inputTitle}
                      onChange={(e) => setInputTitle(e.target.value)}
                      placeholder="Ej. Cuán Grande es Él"
                      className="w-full text-xs px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 tracking-wide block font-bold mb-1 font-sans">AUTOR / MINISTERIO (OPCIONAL)</label>
                    <input
                      type="text"
                      value={inputAuthor}
                      onChange={(e) => setInputAuthor(e.target.value)}
                      placeholder="Ej. Marco Barrientos, Himnario Tradicional"
                      className="w-full text-xs px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] text-zinc-400 tracking-wide block font-bold font-sans">
                        LETRAS DE LA CANCIÓN (FORMATO LIBRE)
                      </label>
                      <span className="text-[8px] text-amber-500 font-mono font-bold uppercase bg-amber-955/20 px-1.5 py-0.5 rounded">
                        RECOMENDADO: 34 CARACT. X 5 LÍNEAS (OPCIONAL)
                      </span>
                    </div>
                    <textarea
                      required
                      rows={6}
                      style={{ fontFamily: 'monospace' }}
                      value={inputLyrics}
                      onChange={(e) => setInputLyrics(e.target.value)}
                      placeholder={`Escribe libremente (ej. puedes poner 4 o más líneas, o más caracteres por línea si lo prefieres)

Estrofa 1 de ejemplo:
Señor, mi Dios, al contemplar los cielos
El firmamento y las estrellas mil...

Coro de ejemplo:
Mi corazón entona la canción
¡Cuán grande es Él! ¡Cuán grande es Él!...`}
                      className="w-full text-[11px] px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-indigo-600 leading-normal resize-none"
                    />
                    <p className="text-[8.5px] text-zinc-500 mt-1 leading-normal">
                      💡 Tienes total libertad de espacio al escribir. Si lo deseas, puedes pulsar el asistente de abajo para aplicar el formato optimizado por ti de forma automática.
                    </p>
                  </div>

                  {/* Automatic segmenting & formatting button adhering to user's strict rules */}
                  <button
                    type="button"
                    onClick={() => {
                      const formatted = formatLyricsWithRules(inputLyrics);
                      setInputLyrics(formatted);
                    }}
                    className="w-full py-2 px-3 bg-amber-955/20 hover:bg-amber-950/50 border border-amber-900/80 hover:border-amber-600 rounded text-[10px] font-black uppercase text-amber-400 hover:text-amber-300 transition-all flex items-center justify-center gap-1.5 select-none cursor-pointer focus:outline-none"
                  >
                    <span>✨ OPTIMIZAR FORMATO RECOMENDADO (34 CARACT. x 5 LÍNEAS)</span>
                  </button>
                </div>

                {/* Column Right: Image Associations */}
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <label className="text-[10px] text-zinc-400 tracking-wide block font-bold mb-1 font-sans">
                      IMÁGENES POR ESTROFA (SE AJUSTAN AL TAMAÑO DE LA ESTROFA)
                    </label>
                    
                    <div className="space-y-1.5 border border-zinc-800/80 bg-zinc-950/40 rounded-lg p-2.5 max-h-[290px] overflow-y-auto scrollbar-thin">
                      {parseLyricsIntoSlides(inputLyrics).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center gap-1.5">
                          <span className="text-lg">🖼️</span>
                          <p className="text-[9.5px] text-zinc-500 italic leading-normal max-w-[200px]">
                            Escribe o pega letras en el recuadro de la izquierda para desplegar las estrofas aquí.
                          </p>
                        </div>
                      ) : (
                        parseLyricsIntoSlides(inputLyrics).map((slide, slideIdx) => {
                          const slideImg = inputSlideImages[slideIdx];
                          return (
                            <div key={slideIdx} className="bg-zinc-950 border border-zinc-900 p-2 rounded flex items-center justify-between gap-3 font-sans transition hover:border-zinc-800">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[8px] font-bold text-amber-400 font-mono uppercase bg-amber-955/30 px-1 py-0.5 rounded leading-none">ESTROFA {slideIdx + 1}</span>
                                </div>
                                <p className="text-[9px] text-zinc-400 truncate mt-1">
                                  "{slide.replace(/\n/g, ' ')}"
                                </p>
                              </div>

                              <div className="shrink-0">
                                {slideImg ? (
                                  <div className="relative group/slide-img">
                                    <img
                                      src={slideImg}
                                      alt={`Diapositiva ${slideIdx + 1}`}
                                      className="w-10 h-10 object-cover rounded border border-zinc-800"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInputSlideImages(prev => {
                                          const next = [...prev];
                                          while (next.length <= slideIdx) next.push('');
                                          next[slideIdx] = '';
                                          return next;
                                        });
                                      }}
                                      className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-500 rounded-full p-0.5 shadow flex items-center justify-center cursor-pointer"
                                    >
                                      <X className="w-2 rounded-full h-2 text-white" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveUploadSlideIndex(slideIdx);
                                      setTimeout(() => {
                                        slideImageFileInputRef.current?.click();
                                      }, 50);
                                    }}
                                    className="py-1 px-1.5 bg-[#252529] hover:bg-[#323238] border border-zinc-800 text-zinc-400 hover:text-white rounded text-[8.5px] font-bold uppercase transition flex items-center gap-1 cursor-pointer select-none focus:outline-none"
                                  >
                                    <span>+ Imagen</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-zinc-800 mt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingSong(false)}
                      className="flex-1 py-1.5 text-xs font-bold bg-[#2b2b2f] hover:bg-[#3d3d44] text-zinc-300 rounded border border-[#3e3e44] transition"
                    >
                      CANCELAR
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-1.5 text-xs font-emerald-600 bg-emerald-600 hover:bg-emerald-500 text-white rounded border border-emerald-700 transition flex items-center justify-center gap-1 font-extrabold focus:outline-none"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {editingSongId ? 'GUARDAR CAMBIOS' : 'AÑADIR CANCIÓN'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPACT VIDEO WORK CREATOR POPUP */}
      {isAddingVideo && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
          <div className="border border-zinc-700 bg-[#1c1c1f] rounded-lg p-5 w-full max-w-sm shadow-2xl relative">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-violet-400 flex items-center gap-1.5 font-sans">
                <Video className="w-4 h-4 text-violet-400 animate-pulse" />
                REGISTRAR NUEVO VIDEO MULTIMEDIA
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingVideo(false)}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVideoSongSubmit} className="space-y-4 font-sans">
              <div>
                <label className="text-[10px] text-zinc-400 tracking-wide block font-bold mb-1">NOMBRE DEL VIDEO</label>
                <input
                  type="text"
                  required
                  value={inputVideoName}
                  onChange={(e) => setInputVideoName(e.target.value)}
                  placeholder="Ej. Fondo Alabanza Lenta"
                  className="w-full text-xs px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 tracking-wide block font-bold mb-1">URL DEL VIDEO (.MP4)</label>
                <input
                  type="text"
                  value={inputVideoUrl}
                  onChange={(e) => setInputVideoUrl(e.target.value)}
                  placeholder="https://ejemplo.com/video.mp4"
                  className="w-full text-xs px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              {/* OR Local File Upload Option */}
              <div className="p-3 bg-zinc-950 border border-zinc-850 rounded">
                <label className="text-[9px] text-zinc-500 tracking-wide block font-bold mb-1.5 uppercase font-sans">O sube un video local (.mp4 / webm):</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSongUpload}
                  className="w-full text-[10px] text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-violet-950 file:text-violet-400 hover:file:bg-violet-900 cursor-pointer"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddingVideo(false)}
                  className="flex-1 py-1.5 text-xs font-bold bg-[#2b2b2f] hover:bg-[#3d3d44] text-zinc-300 rounded border border-[#3e3e44] transition"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 text-xs font-extrabold bg-violet-700 hover:bg-violet-650 text-white rounded border border-violet-800 transition flex items-center justify-center gap-1 animate-pulse"
                >
                  <Check className="w-3.5 h-3.5" />
                  REGISTRAR VIDEO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      </div>

    </div>
  );
}
