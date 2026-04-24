import React from 'react';
import { 
  TrendingUp, Heart, Users, Building, Globe, Mail, 
  Linkedin, Github, Shield, CheckCircle2, Sparkles, 
  Zap, Award, Star, ArrowUpRight, Crown
} from 'lucide-react';
import logo from '../images/logo.png';
import cologo from '../images/cologo.png';
import { useLanguage } from '../i18n';

const About: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const features = [
    { icon: Building, title: 'Property Management', desc: 'Complete solution for managing properties, contracts, and tenants', gradient: 'from-emerald-400 to-teal-500' },
    { icon: TrendingUp, title: 'Financial Tracking', desc: 'Advanced income and expense management with VAT compliance', gradient: 'from-cyan-400 to-blue-500' },
    { icon: Users, title: 'Customer Portal', desc: 'Comprehensive customer database with automated notifications', gradient: 'from-emerald-500 to-emerald-700' },
    { icon: Shield, title: 'Secure & Reliable', desc: 'Enterprise-grade security with 99.9% uptime guarantee', gradient: 'from-slate-700 to-slate-900' }
  ];

  const stats = [
    { value: '2000+', label: 'Customers', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { value: '50+', label: 'Properties', icon: Building, color: 'text-blue-600', bg: 'bg-blue-100' },
    { value: '99.9%', label: 'Uptime', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-100' },
    { value: '24/7', label: 'Support', icon: Award, color: 'text-purple-600', bg: 'bg-purple-100' }
  ];

  return (
    <div className="min-h-screen bg-[#f0f9f4] overflow-x-hidden relative selection:bg-emerald-500 selection:text-white">
      
      {/* --- EXTREME BACKGROUND EFFECTS --- */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-200/40 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-200/30 rounded-full blur-[120px] animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
        
        {/* --- HERO SECTION: HIGH ENERGY --- */}
        <div className="text-center mb-32 relative">
          {/* Floating Icons Decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <Star className="absolute top-0 left-10 text-emerald-400 animate-bounce" size={24} />
            <Sparkles className="absolute top-20 right-10 text-emerald-500 animate-pulse" size={30} />
            <Crown className="absolute bottom-10 left-1/4 text-emerald-300 rotate-12" size={40} />
          </div>

          <div className="flex justify-center mb-12">
            <div className="relative group cursor-pointer">
              {/* Spinning outer ring */}
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-[4rem] blur-xl opacity-40 group-hover:opacity-80 group-hover:rotate-180 transition-all duration-1000" />
              <div className="relative bg-white p-12 md:p-20 rounded-[3.5rem] shadow-2xl border-4 border-white transform group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500">
                <img src={logo} alt="Amlak" className="h-48 md:h-64 w-auto object-contain drop-shadow-xl" />
              </div>
            </div>
          </div>

          <div className="relative inline-block mb-4">
            <h1 className="text-8xl md:text-[10rem] font-black tracking-tighter text-slate-900 leading-none">{t('app.title')}<span className="text-emerald-500 animate-ping absolute">.</span><span className="text-emerald-500">.</span>
            </h1>
          </div>
          
          <p className="text-2xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-slate-800 to-emerald-600 mb-10 tracking-tight">
            Next-Gen Property Intelligence
          </p>

          <div className="flex flex-wrap justify-center items-center gap-6">
            <div className="flex items-center gap-4 px-8 py-4 bg-white shadow-xl rounded-full border border-emerald-100 hover:border-emerald-500 transition-all group">
              <Sparkles className="text-emerald-500 group-hover:rotate-180 transition-transform" />
              <span className="text-slate-500 font-bold">Incubated by</span>
              <img src={cologo} alt="RR Group" className="h-8 grayscale group-hover:grayscale-0 transition-all" />
              <span className="font-black text-emerald-600 text-xl tracking-tighter">RR GROUP</span>
            </div>
          </div>
        </div>

        {/* --- STATS: 3D LIFT CARDS --- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-32">
          {stats.map((stat, idx) => (
            <div key={idx} className="group relative bg-white p-10 rounded-[2.5rem] shadow-xl hover:shadow-emerald-200 transition-all duration-500 hover:-translate-y-4 border border-slate-50 cursor-default overflow-hidden">
              <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} opacity-20 rounded-bl-[5rem] group-hover:scale-150 transition-transform`} />
              <div className="relative">
                <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-6 shadow-inner`}>
                  <stat.icon size={28} />
                </div>
                <div className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">{stat.value}</div>
                <div className="text-sm font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* --- CREATOR SECTION: LUXURY DARK CONTRAST --- */}
        <div className="mb-32 group">
          <div className="relative bg-slate-900 rounded-[4rem] p-12 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(16,185,129,0.05)_50%,transparent_75%)] bg-[length:250%_250%] animate-[gradient_15s_linear_infinite]" />
            
            <div className="relative flex flex-col lg:flex-row items-center gap-16">
              <div className="relative">
                <div className="w-56 h-56 rounded-[3rem] bg-gradient-to-tr from-emerald-400 via-cyan-400 to-emerald-600 p-1.5 rotate-6 group-hover:rotate-0 transition-all duration-700 shadow-2xl">
                  <div className="w-full h-full rounded-[2.7rem] bg-slate-900 flex items-center justify-center text-6xl font-black text-white">MS</div>
                </div>
                <div className="absolute -top-4 -right-4 bg-emerald-500 text-white p-4 rounded-3xl shadow-xl animate-bounce">
                  <Crown size={24} />
                </div>
              </div>
              
              <div className="flex-1 text-center lg:text-left text-white">
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-6">
                  <h2 className="text-5xl md:text-6xl font-black tracking-tight">Muhammed Shahzad</h2>
                  <div className="bg-emerald-500 rounded-full p-1.5 shadow-lg shadow-emerald-500/50">
                    <CheckCircle2 size={28} />
                  </div>
                </div>
                
                <p className="text-2xl font-bold text-emerald-400 mb-6 flex items-center justify-center lg:justify-start gap-3">
                  <Zap size={24} className="fill-emerald-400" /> Founder & Lead Developer
                </p>
                
                <div className="flex flex-wrap gap-4 justify-center lg:justify-start mb-8">
                  {['⚡ 16 Years Old', '🇸🇦 Based in KSA', '🚀 Full-Stack Expert'].map((tag, i) => (
                    <span key={i} className="px-6 py-2 bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl text-sm font-black tracking-wide">{tag}</span>
                  ))}
                </div>

                <p className="text-slate-400 text-xl leading-relaxed mb-10 max-w-2xl font-medium">
                  Revolutionizing the Saudi property market with <span className="text-white font-bold underline decoration-emerald-500">intelligent code</span>. Building the future of PropTech at the intersection of luxury and utility.
                </p>
                
                <div className="flex gap-4 justify-center lg:justify-start">
                  {[Mail, Linkedin, Github].map((Icon, i) => (
                    <a key={i} href="#" className="p-5 bg-white/5 border border-white/10 rounded-[1.5rem] hover:bg-emerald-500 hover:border-emerald-400 transition-all duration-300 hover:scale-110 group/icon">
                      <Icon size={24} className="group-hover/icon:rotate-12 transition-transform" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- FEATURES: NEON LIGHT BORDERS --- */}
        <div className="mb-32">
          <div className="text-center mb-16">
            <h3 className="text-6xl font-black text-slate-900 tracking-tighter mb-4">The Amlak Edge</h3>
            <div className="h-2 w-32 bg-emerald-500 mx-auto rounded-full" />
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, idx) => (
              <div key={idx} className="group relative bg-white border border-slate-100 rounded-[3rem] p-12 hover:border-emerald-500 transition-all duration-500 shadow-xl overflow-hidden hover:-translate-y-2">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity`} />
                <div className="flex items-start gap-8 relative z-10">
                  <div className={`p-6 rounded-[2rem] bg-gradient-to-br ${feature.gradient} shadow-2xl text-white transform group-hover:rotate-12 transition-transform duration-500`}>
                    <feature.icon size={40} />
                  </div>
                  <div>
                    <h4 className="text-3xl font-black text-slate-900 mb-4">{feature.title}</h4>
                    <p className="text-slate-500 text-lg font-medium leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- FOOTER: CLEAN & ICONIC --- */}
        <div className="bg-white border-2 border-emerald-500 rounded-[4rem] p-16 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-emerald-500 translate-y-full group-hover:translate-y-0 transition-transform duration-700 ease-in-out" />
          <div className="relative z-10">
            <img src={cologo} alt="RR Group" className="h-16 mx-auto mb-8 group-hover:brightness-0 group-hover:invert transition-all" />
            <h3 className="text-4xl font-black text-slate-900 group-hover:text-white transition-colors mb-4">RR GROUP INNOVATIONS</h3>
            <p className="text-slate-500 group-hover:text-emerald-50 text-xl font-bold mb-12">Innovation. Reliability. Excellence.</p>
            
            <div className="flex flex-wrap justify-center gap-6">
              <button className="flex items-center gap-3 px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black group-hover:bg-white group-hover:text-emerald-600 transition-all shadow-2xl">
                Official Website <ArrowUpRight />
              </button>
              <div className="flex items-center gap-3 px-10 py-5 bg-emerald-100 text-emerald-700 rounded-[2rem] font-black group-hover:bg-emerald-400 group-hover:text-white transition-all shadow-xl">
                <Heart className="animate-ping" /> Made in KSA
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
          © 2026 AMLAK ECOSYSTEM | DESIGNED BY MUHAMMED SHAHZAD
        </div>
      </div>
    </div>
  );
};

export default About;