% Function that returns number of violated clauses for given variable

% INPUT :
% N - Number of variables
% X - Nx1 binary vector (configuration of oscillators)
% small_eps - Currently 0
% Clauses - Clause matrix
% nc - Number of Clauses

% OUTPUT :
% vali - The number of violated for each variable
% val - The number of violated for all variable

function [vali,val]=rnode_chip(N,X,small_eps,Clauses,nc)

C=nc;
vali=0;
val=0;
m_i=0;
V_m_i=0;

CMat=zeros(C,N);
for j=1:N
    for k=1:C
        if(any(Clauses(k,:)==j))
            CMat(k,j)=1;
        end
        if(any(Clauses(k,:)==-j))
            CMat(k,j)=-1;
        end
    end
end


valtmp=zeros(C,1);
valtmp=double(CMat==-1)*ones(size(X))+CMat*X;
val_vec=zeros(C,1);
val_vec=double(valtmp==0); % 0 means clause is unsat (OR so any element being 1=>sat)
for i=1:N
    vali(i)=sum(val_vec(CMat(:,i)~=0))+small_eps;
end
val=sum(val_vec);