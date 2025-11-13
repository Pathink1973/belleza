import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Euro, X, Phone, Plus, Trash, GripVertical, CheckCircle, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { ServiceVariantFormData } from '../../types/service';

interface TeamMember {
  id: string;
  name: string;
  imageUrl: string;
  profile_id?: string;
  is_primary?: boolean;
}

interface ServiceFormData {
  title: string;
  description: string;
  price: string;
  duration: string;
  images: string[];
  whatsapp_number: string;
  category: string;
  team: TeamMember[];
  variants: ServiceVariantFormData[];
  is_featured: boolean;
  featured_priority: number;
}

const SERVICE_CATEGORIES = [
  'Cabelo e penteado',
  'Unhas',
  'Sobrancelhas',
  'Massagem',
  'Barbearia',
  'Depilação',
  'Tratamento Facial',
  'Tratamento Corporal',
  'Injectáveis',
  'Tatuagem e piercing',
  'Maquilhagem',
  'Fitness'
] as const;


export function ServiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [formData, setFormData] = useState<ServiceFormData>({
    title: '',
    description: '',
    price: '',
    duration: '30',
    images: [],
    whatsapp_number: '',
    category: 'Cabelo e penteado',
    team: [],
    variants: [],
    is_featured: false,
    featured_priority: 0
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [isSuperAdminEditing, setIsSuperAdminEditing] = useState(false);
  const [serviceOwner, setServiceOwner] = useState<{ id: string; name: string } | null>(null);
  const [superAdminReason, setSuperAdminReason] = useState('');
  const [originalServiceData, setOriginalServiceData] = useState<any>(null);
  const [showSuperAdminConfirm, setShowSuperAdminConfirm] = useState(false);

  useEffect(() => {
    if (id) {
      loadService();
    } else {
      initializeTeamWithOwner();
    }

    const storedReason = sessionStorage.getItem('superAdminEditReason');
    const storedServiceId = sessionStorage.getItem('superAdminEditingServiceId');
    if (storedReason && storedServiceId === id) {
      setSuperAdminReason(storedReason);
      sessionStorage.removeItem('superAdminEditReason');
      sessionStorage.removeItem('superAdminEditingServiceId');
    }
  }, [id]);

  const initializeTeamWithOwner = async () => {
    if (!user) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      if (profileData) {
        const ownerMember: TeamMember = {
          id: uuidv4(),
          name: profileData.full_name,
          imageUrl: profileData.avatar_url || '',
          profile_id: profileData.id,
          is_primary: true
        };

        setFormData(prev => ({
          ...prev,
          team: [ownerMember]
        }));
      }
    } catch (err) {
      console.error('Error loading owner profile:', err);
    }
  };

  const loadService = async () => {
    try {
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('id', id)
        .single();

      if (serviceError) throw serviceError;

      const { data: variantsData, error: variantsError } = await supabase
        .from('service_variants')
        .select('*')
        .eq('service_id', id)
        .order('display_order', { ascending: true });

      if (variantsError) throw variantsError;

      if (serviceData) {
        // Check if super admin is editing someone else's service
        if (user && user.role === 'super_admin' && serviceData.professional_id !== user.id) {
          setIsSuperAdminEditing(true);
          const { data: ownerData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', serviceData.professional_id)
            .single();
          if (ownerData) {
            setServiceOwner({ id: ownerData.id, name: ownerData.full_name });
          }
        }

        // Store original service data for tracking changes (including variants)
        setOriginalServiceData({
          title: serviceData.title,
          description: serviceData.description,
          price: serviceData.price,
          duration: serviceData.duration,
          category: serviceData.category,
          images: serviceData.images,
          whatsapp_number: serviceData.whatsapp_number,
          professional_id: serviceData.professional_id,
          variants: (variantsData || []).map((v: any) => ({
            id: v.id,
            name: v.name,
            price: v.price,
            duration: v.duration,
            display_order: v.display_order
          }))
        });

        let teamData = serviceData.team || [];

        // Remove duplicates based on profile_id or name+imageUrl
        const seen = new Map();
        teamData = teamData.filter((member: TeamMember) => {
          const key = member.profile_id || `${member.name}-${member.imageUrl}`;
          if (seen.has(key)) {
            return false;
          }
          seen.set(key, true);
          return true;
        });

        // Ensure at least one member is marked as primary
        if (teamData.length > 0 && !teamData.some((m: TeamMember) => m.is_primary)) {
          teamData[0].is_primary = true;
        }

        const parseDuration = (duration: string): string => {
          if (duration.includes(':')) {
            const parts = duration.split(':');
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            return String(hours * 60 + minutes);
          }
          return duration.replace(' minutes', '').replace(' minutos', '');
        };

        setFormData({
          title: serviceData.title,
          description: serviceData.description || '',
          price: serviceData.price.toString(),
          duration: parseDuration(serviceData.duration),
          images: serviceData.images || [],
          whatsapp_number: serviceData.whatsapp_number || '',
          category: serviceData.category,
          team: teamData,
          variants: (variantsData || []).map((v, index) => ({
            id: v.id,
            name: v.name,
            price: v.price.toString(),
            duration: parseDuration(v.duration),
            display_order: v.display_order ?? index
          })),
          is_featured: serviceData.is_featured || false,
          featured_priority: serviceData.featured_priority || 0
        });
      }
    } catch (err) {
      console.error('Error loading service:', err);
      setError('Erro ao carregar serviço');
    } finally {
      setInitialLoading(false);
    }
  };

  const [imageUrlInput, setImageUrlInput] = useState('');

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) {
      setError('Por favor, insira uma URL válida');
      return;
    }

    try {
      new URL(imageUrlInput);
      setFormData(prev => ({ ...prev, images: [...prev.images, imageUrlInput] }));
      setImageUrlInput('');
      setSuccess('Imagem adicionada com sucesso');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('URL inválida. Por favor, insira uma URL completa (ex: https://exemplo.com/imagem.jpg)');
    }
  };

  const handleRemoveImage = async (imageUrl: string) => {
    if (!imageUrl) return;

    try {
      setFormData(prev => ({
        ...prev,
        images: prev.images.filter(img => img !== imageUrl)
      }));
      setSuccess('Imagem removida com sucesso');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error removing image:', err);
      setError('Erro ao remover imagem');
    }
  };

  const handleAddTeamMember = () => {
    setFormData(prev => ({
      ...prev,
      team: [...prev.team, { id: uuidv4(), name: '', imageUrl: '', is_primary: false }]
    }));
  };

  const handleRemoveTeamMember = (memberId: string, isPrimary?: boolean) => {
    if (isPrimary) {
      setError('Não é possível remover o profissional principal do serviço');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setFormData(prev => ({
      ...prev,
      team: prev.team.filter(member => member.id !== memberId)
    }));
  };

  const handleTeamMemberChange = (memberId: string, field: 'name' | 'imageUrl', value: string) => {
    setFormData(prev => ({
      ...prev,
      team: prev.team.map(member =>
        member.id === memberId
          ? { ...member, [field]: value }
          : member
      )
    }));
  };

  const handleAddVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, {
        id: uuidv4(),
        name: '',
        price: '',
        duration: '30',
        display_order: prev.variants.length
      }]
    }));
  };

  const handleRemoveVariant = (variantId: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== variantId)
    }));
  };

  const handleVariantChange = (variantId: string, field: keyof ServiceVariantFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(variant =>
        variant.id === variantId
          ? { ...variant, [field]: value }
          : variant
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Utilizador não autenticado');
      return;
    }

    // Validate super admin reason if editing another professional's service
    if (isSuperAdminEditing && id && (!superAdminReason.trim() || superAdminReason.trim().length < 10)) {
      setError('Como Super Admin, deve fornecer uma razão com pelo menos 10 caracteres para editar este serviço.');
      return;
    }

    if (isSuperAdminEditing && !showSuperAdminConfirm) {
      setShowSuperAdminConfirm(true);
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);
    setShowSuperAdminConfirm(false);

    const whatsappRegex = /^\+?[1-9]\d{1,14}$/;
    if (!whatsappRegex.test(formData.whatsapp_number)) {
      setError('Por favor, insira um número de WhatsApp válido com código do país');
      setLoading(false);
      return;
    }

    const incompleteTeamMembers = formData.team.filter(
      member => !member.name.trim()
    );
    if (incompleteTeamMembers.length > 0) {
      setError('Por favor, preencha o nome de todos os membros da equipe ou remova os membros incompletos');
      setLoading(false);
      return;
    }

    const incompleteVariants = formData.variants.filter(
      variant => !variant.name.trim() || !variant.price || parseFloat(variant.price) <= 0
    );
    if (incompleteVariants.length > 0) {
      setError('Por favor, preencha o nome e preço de todas as variantes ou remova as variantes incompletas');
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('=== DEBUG INFO ===');
      console.log('Current session:', session);
      console.log('User from store:', user);
      console.log('User ID:', user.id);
      console.log('User role:', user.role);
      console.log('Form Data:', formData);

      if (!session) {
        setError('Sessão expirada. Por favor, faça login novamente.');
        setLoading(false);
        return;
      }

      // Remove duplicates before saving
      const seen = new Map();
      const uniqueTeam = formData.team.filter(member => {
        const key = member.profile_id || `${member.name}-${member.imageUrl}`;
        if (seen.has(key)) {
          return false;
        }
        seen.set(key, true);
        return true;
      });

      // Sync team members to service_team_members table and get their IDs
      const teamDataPromises = uniqueTeam.map(async (member) => {
        // Skip primary member (service owner)
        if (member.is_primary) {
          return {
            id: member.id,
            name: member.name.trim(),
            imageUrl: member.imageUrl,
            profile_id: member.profile_id,
            is_primary: true
          };
        }

        // For non-primary members, sync to service_team_members table
        const serviceId = id || null;
        if (!serviceId) {
          // New service - will sync after creation
          return {
            id: member.id,
            name: member.name.trim(),
            imageUrl: member.imageUrl,
            is_primary: false
          };
        }

        // Update existing service - check if team member exists
        const { data: existingMember } = await supabase
          .from('service_team_members')
          .select('id')
          .eq('service_id', serviceId)
          .eq('name', member.name.trim())
          .eq('photo_url', member.imageUrl)
          .maybeSingle();

        let teamMemberId;
        if (existingMember) {
          teamMemberId = existingMember.id;
        } else {
          // Create new team member
          const { data: newMember, error: insertError } = await supabase
            .from('service_team_members')
            .insert({
              service_id: serviceId,
              name: member.name.trim(),
              photo_url: member.imageUrl,
              display_order: uniqueTeam.indexOf(member)
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error creating team member:', insertError);
            return {
              id: member.id,
              name: member.name.trim(),
              imageUrl: member.imageUrl,
              is_primary: false
            };
          }
          teamMemberId = newMember.id;
        }

        return {
          id: member.id,
          name: member.name.trim(),
          imageUrl: member.imageUrl,
          team_member_db_id: teamMemberId,
          is_primary: false
        };
      });

      const teamDataResolved = await Promise.all(teamDataPromises);

      const serviceData = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        duration: `${formData.duration} minutos`,
        images: formData.images,
        professional_id: id && originalServiceData?.professional_id
          ? originalServiceData.professional_id
          : user.id,
        whatsapp_number: formData.whatsapp_number,
        category: formData.category,
        team: teamDataResolved,
        is_featured: formData.is_featured,
        featured_priority: formData.featured_priority
      };

      console.log('Service Data to save:', serviceData);

      if (isSuperAdminEditing && serviceData.professional_id !== originalServiceData?.professional_id) {
        setError('ERRO DE SEGURANÇA: Tentativa de mudar propriedade do serviço detectada. Esta ação não é permitida.');
        setLoading(false);
        return;
      }

      let error, data;
      if (id) {
        ({ error, data } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', id)
          .select());

        // If super admin is editing, log the modification (including variants)
        if (isSuperAdminEditing && serviceOwner && originalServiceData) {
          const changes: any = {};
          if (originalServiceData.title !== serviceData.title) {
            changes.title = { from: originalServiceData.title, to: serviceData.title };
          }
          if (originalServiceData.description !== serviceData.description) {
            changes.description = { from: originalServiceData.description, to: serviceData.description };
          }
          if (originalServiceData.price !== serviceData.price) {
            changes.price = { from: originalServiceData.price, to: serviceData.price };
          }
          if (originalServiceData.duration !== serviceData.duration) {
            changes.duration = { from: originalServiceData.duration, to: serviceData.duration };
          }
          if (originalServiceData.category !== serviceData.category) {
            changes.category = { from: originalServiceData.category, to: serviceData.category };
          }
          if (JSON.stringify(originalServiceData.images) !== JSON.stringify(serviceData.images)) {
            changes.images = { from: originalServiceData.images, to: serviceData.images };
          }
          if (originalServiceData.whatsapp_number !== serviceData.whatsapp_number) {
            changes.whatsapp_number = { from: originalServiceData.whatsapp_number, to: serviceData.whatsapp_number };
          }

          // Track variant changes
          const originalVariants = originalServiceData.variants || [];
          const newVariants = formData.variants.map(v => ({
            name: v.name,
            price: parseFloat(v.price),
            duration: `${v.duration} minutos`
          }));

          if (JSON.stringify(originalVariants.map((v: any) => ({ name: v.name, price: v.price, duration: v.duration }))) !== JSON.stringify(newVariants)) {
            changes.variants = {
              from: originalVariants.map((v: any) => ({ name: v.name, price: v.price, duration: v.duration })),
              to: newVariants
            };
          }

          await supabase
            .from('service_modifications_log')
            .insert({
              service_id: id,
              service_title: serviceData.title,
              professional_id: serviceOwner.id,
              admin_id: user.id,
              action_type: 'edited',
              reason: superAdminReason.trim(),
              changes_made: changes
            });

          // Send notification to service owner about the edit
          await supabase
            .from('notifications')
            .insert({
              user_id: serviceOwner.id,
              title: 'Super Admin Editou o Seu Serviço',
              message: `O Super Admin editou o serviço "${serviceData.title}". Razão: ${superAdminReason.trim()}`,
              type: 'service_edit',
              read: false
            });
        }
      } else {
        ({ error, data } = await supabase
          .from('services')
          .insert([serviceData])
          .select());
      }

      console.log('Supabase Response:', { error, data });

      if (error) {
        console.error('=== SUPABASE ERROR DETAILS ===');
        console.error('Message:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
        console.error('Code:', error.code);
        throw error;
      }

      const savedServiceId = id || data?.[0]?.id;

      // Sync team members for newly created services
      if (!id && savedServiceId) {
        const nonPrimaryMembers = uniqueTeam.filter(m => !m.is_primary);

        for (const member of nonPrimaryMembers) {
          const { data: teamMember, error: teamError } = await supabase
            .from('service_team_members')
            .insert({
              service_id: savedServiceId,
              name: member.name.trim(),
              photo_url: member.imageUrl,
              display_order: uniqueTeam.indexOf(member)
            })
            .select()
            .single();

          if (teamError) {
            console.error('Error creating team member:', teamError);
          } else if (teamMember) {
            // Update service team JSONB with the DB ID
            const { error: updateError } = await supabase
              .from('services')
              .update({
                team: uniqueTeam.map(m => {
                  if (m.id === member.id) {
                    return {
                      ...m,
                      team_member_db_id: teamMember.id
                    };
                  }
                  return m;
                })
              })
              .eq('id', savedServiceId);

            if (updateError) {
              console.error('Error updating team with DB IDs:', updateError);
            }
          }
        }
      }

      if (formData.variants.length > 0 && savedServiceId) {
        if (id) {
          const { error: deleteError } = await supabase
            .from('service_variants')
            .delete()
            .eq('service_id', savedServiceId);

          if (deleteError) {
            console.error('Error deleting old variants:', deleteError);
          }
        }

        const variantsToInsert = formData.variants.map((variant, index) => ({
          service_id: savedServiceId,
          name: variant.name.trim(),
          price: parseFloat(variant.price),
          duration: `${variant.duration} minutos`,
          display_order: index
        }));

        const { error: variantsError } = await supabase
          .from('service_variants')
          .insert(variantsToInsert);

        if (variantsError) {
          console.error('Error saving variants:', variantsError);
          throw new Error('Erro ao guardar variantes do serviço');
        }
      }

      if (isSuperAdminEditing) {
        setSuccess('Serviço editado com sucesso! O proprietário foi notificado.');
      } else {
        setSuccess('Serviço guardado com sucesso!');
      }
      setTimeout(() => {
        if (user.role === 'super_admin' && isSuperAdminEditing) {
          navigate('/super-admin/dashboard');
        } else {
          navigate('/professional/services');
        }
      }, 2000);
    } catch (err: any) {
      console.error('Error saving service:', err);
      const errorMessage = err?.message || err?.error_description || 'Erro desconhecido';
      setError(`Erro ao guardar serviço: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {id ? 'Editar Serviço' : 'Adicionar Novo Serviço'}
      </h1>

      {isSuperAdminEditing && serviceOwner && (
        <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-lg shadow-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-bold text-orange-900">
                Modo Manutenção Remota - Super Admin
              </h3>
              <div className="mt-2 text-sm text-orange-800">
                <p>
                  <strong>Proprietário do Serviço:</strong> {serviceOwner.name}
                </p>
                <p className="mt-1 font-medium">
                  Está a editar este serviço em modo de manutenção remota. O proprietário permanece como {serviceOwner.name} e será notificado de todas as alterações.
                </p>
                <p className="mt-1 text-xs">
                  ⚠️ Não pode assumir propriedade deste serviço. Apenas pode fazer alterações para ajudar o dono.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow-lg rounded-lg p-6">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 border border-green-200 p-4">
            <p className="text-sm text-green-800 font-medium">{success}</p>
          </div>
        )}

        {isSuperAdminEditing && serviceOwner && (
          <div className="border-l-4 border-orange-400 bg-orange-50 p-4">
            <label htmlFor="superAdminReason" className="block text-sm font-bold text-orange-900 mb-2">
              Razão da Edição (Obrigatório) <span className="text-red-600">*</span>
            </label>
            <textarea
              id="superAdminReason"
              required
              value={superAdminReason}
              onChange={(e) => setSuperAdminReason(e.target.value)}
              className="mt-1 block w-full rounded-md border-orange-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
              rows={3}
              placeholder="Explique porque está a fazer esta edição... (mínimo 10 caracteres)"
            />
            <p className="mt-1 text-xs text-orange-700">
              Esta razão será registada e o proprietário do serviço será notificado. {superAdminReason.length}/10 caracteres
            </p>
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Nome do Serviço
          </label>
          <input
            type="text"
            id="title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="input-glow mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
            placeholder="ex: Corte de Cabelo e Penteado"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Categoria
          </label>
          <select
            id="category"
            required
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="input-glow mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
          >
            {SERVICE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700">
            Número do WhatsApp
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Phone className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              id="whatsapp"
              required
              value={formData.whatsapp_number}
              onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              className="input-glow block w-full pl-10 rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
              placeholder="+351912345678"
            />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Digite seu número do WhatsApp com código do país (ex: +351912345678)
          </p>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Descrição
          </label>
          <textarea
            id="description"
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="input-glow mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
            placeholder="Descreva o seu serviço..."
          />
        </div>

        <div className={`space-y-4 border-t pt-6 ${isSuperAdminEditing ? 'bg-orange-50 -mx-6 px-6 py-6 rounded-lg border-2 border-orange-200' : ''}`}>
          {isSuperAdminEditing && (
            <div className="mb-4 p-3 bg-orange-100 border border-orange-300 rounded-md">
              <p className="text-sm font-medium text-orange-900">
                ⚠️ Modo Super Admin: A editar variantes de outro profissional
              </p>
              <p className="text-xs text-orange-800 mt-1">
                Todas as alterações nas variantes serão registadas e o proprietário será notificado.
              </p>
            </div>
          )}
          <div className="flex justify-between items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Preços e Durações
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Adicione diferentes opções de preço e duração para este serviço
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddVariant}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Variante
            </button>
          </div>

          {formData.variants.length > 0 ? (
            <div className="space-y-3">
              {formData.variants.map((variant, index) => (
                <div
                  key={variant.id}
                  className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Nome da Variante *
                      </label>
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(e) => handleVariantChange(variant.id, 'name', e.target.value)}
                        placeholder="ex: Corte Adulto"
                        className="input-glow block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Preço (€) *
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 text-sm">€</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={variant.price}
                          onChange={(e) => handleVariantChange(variant.id, 'price', e.target.value)}
                          placeholder="11,68"
                          className="input-glow block w-full pl-8 rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Duração
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Clock className="h-4 w-4 text-gray-400" />
                        </div>
                        <select
                          value={variant.duration}
                          onChange={(e) => handleVariantChange(variant.id, 'duration', e.target.value)}
                          className="input-glow block w-full pl-9 rounded-md border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="15">15 min</option>
                          <option value="30">30 min</option>
                          <option value="45">45 min</option>
                          <option value="60">1 hora</option>
                          <option value="90">1.5 horas</option>
                          <option value="120">2 horas</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveVariant(variant.id)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                    title="Remover variante"
                  >
                    <Trash className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-500">
                Nenhuma variante adicionada. Use o preço e duração padrão abaixo ou adicione variantes personalizadas.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 border-t pt-6">
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">
              Preço Padrão (€)
            </label>
            <p className="text-xs text-gray-500 mt-1">
              {formData.variants.length > 0 ? 'Usado como fallback' : 'Preço principal do serviço'}
            </p>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Euro className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                id="price"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="input-glow block w-full pl-10 rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
              Duração Padrão
            </label>
            <p className="text-xs text-gray-500 mt-1">
              {formData.variants.length > 0 ? 'Usado como fallback' : 'Duração principal do serviço'}
            </p>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Clock className="h-5 w-5 text-gray-400" />
              </div>
              <select
                id="duration"
                required
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="input-glow block w-full pl-10 rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
              >
                <option value="30">30 minutos</option>
                <option value="45">45 minutos</option>
                <option value="60">1 hora</option>
                <option value="90">1.5 horas</option>
                <option value="120">2 horas</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Imagens do Serviço
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              placeholder="Cole a URL da imagem (ex: https://exemplo.com/imagem.jpg)"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            />
            <button
              type="button"
              onClick={handleAddImageUrl}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 whitespace-nowrap"
            >
              Adicionar
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Pode adicionar múltiplas imagens. Insira uma URL por vez.
          </p>
        </div>

        {formData.images.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {formData.images.map((imageUrl, index) => (
              <div key={index} className="relative">
                <img
                  src={imageUrl}
                  alt={`Imagem ${index + 1}`}
                  className="h-32 w-full object-cover rounded-md"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = 'https://via.placeholder.com/400x200?text=Imagem+Inválida';
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(imageUrl)}
                  className="absolute -top-2 -right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Team Section */}
        <div className="space-y-6">
          {/* Equipa Atual Section */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Users className="h-6 w-6 mr-3 text-blue-600" />
              Equipa Atual
              <span className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-full">
                {formData.team.length} {formData.team.length === 1 ? 'Membro' : 'Membros'}
              </span>
            </h3>

            {formData.team.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum membro na equipa</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.team.map((member) => (
                  <div
                    key={member.id}
                    className={`relative p-5 rounded-xl border-2 transition-all duration-300 ${
                      member.is_primary
                        ? 'bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 border-blue-300 shadow-md'
                        : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="relative">
                          <img
                            src={member.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`}
                            alt={member.name}
                            className="h-16 w-16 rounded-full object-cover border-3 border-white shadow-md"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`;
                            }}
                          />
                          {member.is_primary && (
                            <div className="absolute -bottom-1 -right-1 bg-blue-600 h-6 w-6 rounded-full border-2 border-white flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="text-lg font-bold text-gray-900 truncate">
                              {member.name}
                            </h4>
                          </div>
                          {member.is_primary && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Principal
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Team Members Section */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex justify-between items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Adicionar Colaboradores
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Adicione membros decorativos à sua equipa (apenas nome e foto)
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddTeamMember}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Membro
              </button>
            </div>

            <div className="space-y-4">
              {formData.team.filter(m => !m.is_primary).map((member) => (
                <div key={member.id} className="flex items-start space-x-4 p-4 border rounded-lg bg-gray-50">
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome do Profissional *
                      </label>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => handleTeamMemberChange(member.id, 'name', e.target.value)}
                        placeholder="Ex: João Silva"
                        className="input-glow block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        URL da Foto (opcional)
                      </label>
                      <input
                        type="url"
                        value={member.imageUrl}
                        onChange={(e) => handleTeamMemberChange(member.id, 'imageUrl', e.target.value)}
                        placeholder="https://exemplo.com/foto.jpg"
                        className="input-glow block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
                      />
                    </div>

                    {member.imageUrl && member.name && (
                      <div className="flex items-center space-x-3 pt-2">
                        <img
                          src={member.imageUrl}
                          alt={member.name}
                          className="h-16 w-16 object-cover rounded-full border-2 border-blue-200"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`;
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">Pré-visualização</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveTeamMember(member.id, member.is_primary)}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Remover membro"
                  >
                    <Trash className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Destaque</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_featured"
                checked={formData.is_featured}
                onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_featured" className="ml-2 block text-sm text-gray-700">
                Marcar como serviço em destaque
              </label>
            </div>
            <p className="text-xs text-gray-500">
              Serviços em destaque aparecem com prioridade na página inicial e nos resultados de pesquisa.
            </p>

            {formData.is_featured && (
              <div>
                <label htmlFor="featured_priority" className="block text-sm font-medium text-gray-700 mb-2">
                  Prioridade (0-100)
                </label>
                <input
                  type="number"
                  id="featured_priority"
                  min="0"
                  max="100"
                  value={formData.featured_priority}
                  onChange={(e) => setFormData({ ...formData, featured_priority: parseInt(e.target.value) || 0 })}
                  className="input-glow block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Números maiores aparecem primeiro. Padrão: 0
                </p>
              </div>
            )}
          </div>
        </div>

        {isSuperAdminEditing && id && (
          <div className="border-t border-gray-200 pt-6">
            <label htmlFor="superAdminReason" className="block text-sm font-medium text-gray-700 mb-2">
              Razão para Editar Este Serviço <span className="text-red-600">*</span>
            </label>
            <textarea
              id="superAdminReason"
              value={superAdminReason}
              onChange={(e) => setSuperAdminReason(e.target.value)}
              placeholder="Explique porque está a editar este serviço... (mínimo 10 caracteres)"
              className="input-glow block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
              rows={4}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              {superAdminReason.length} / 10 caracteres mínimos
            </p>
            <p className="mt-2 text-xs text-orange-600 font-medium">
              Esta razão será enviada ao proprietário do serviço junto com a notificação.
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              if (user?.role === 'super_admin' && isSuperAdminEditing) {
                navigate('/super-admin/dashboard');
              } else {
                navigate('/professional/services');
              }
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      </form>

      {showSuperAdminConfirm && isSuperAdminEditing && serviceOwner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirmar Edição como Super Admin</h3>
            <div className="mb-4 p-4 bg-orange-50 border-l-4 border-orange-400 rounded">
              <p className="text-sm text-orange-900 font-medium mb-2">
                ⚠️ Está prestes a editar um serviço em modo de manutenção remota
              </p>
              <div className="text-sm text-gray-700 space-y-1">
                <p><strong>Proprietário:</strong> {serviceOwner.name}</p>
                <p><strong>Razão:</strong> {superAdminReason}</p>
              </div>
            </div>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-900">
                <strong>Confirmação de Segurança:</strong>
              </p>
              <ul className="text-xs text-blue-800 mt-2 space-y-1 list-disc list-inside">
                <li>O proprietário permanece como <strong>{serviceOwner.name}</strong></li>
                <li>Não está a assumir propriedade do serviço</li>
                <li>O proprietário será notificado desta edição</li>
                <li>A edição será registada no histórico de auditoria</li>
                {formData.variants.length > 0 && (
                  <li className="font-semibold text-orange-800">
                    Editando {formData.variants.length} variante(s) de preço/duração
                  </li>
                )}
              </ul>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Confirma que pretende prosseguir com esta edição de manutenção remota?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSuperAdminConfirm(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={(e) => {
                  handleSubmit(e as any);
                }}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium"
              >
                Confirmar e Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
