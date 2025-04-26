% Function to reach a SAT solution for a sub problem 

% INPUT : 
% N -  Number of variables
% K - Number of partitions
% VC - Current value set to 1 wlog
% CMat -  Clause by variable dependency matrix
% var - Number of variable
% small_eps -  Small term that makes all rates strictly positive
% X_final - Initial state to the smaller problem
% node_set - Node set for the partitions
% Clause_set - Clauses local to the partitions
% p - pth partiton


% OUTPUT :
% X - Final SAT solution of MCMC algorithm
% TvalV - Time to reach SAT solution


function [X,TvalV] = MCMC_small_solver(N,K,VC,small_eps,X_final,node_set,Clause_set,p)

N=size(node_set{p},2);
X_final1=zeros(N,1);
X = X_final(node_set{p});
nc=size(Clause_set{p},1);

L=zeros(N,1); % Initially all nodes have full current
Lmax=max(L); % Initially equal to 0
Y=X; % Size is N x (Lmax+1)

rate_flag = zeros(N,K+1);
QV = ones(K+1,N)/VC;

L=zeros(N,1);
Lmax=max(L);
Y=X;
TvalV=0;
for i=2:K+1
    Xtmp=X;
    Ltmp=L;
    Lmaxtmp=Lmax;

    [vtmpj,vtmp]=rnode_chip(N,X,small_eps,Clause_set{p},nc);

    q=0;
    for j=1:N
        tmp=1/VC;
        if vtmpj(j) ==0
            rate_flag(j,i)=1;
            q(j) =QV(i-1,j);
            L(j)=L(j)+1;
        else
            if L(j)>0
                q(j)=min(min(vtmpj(j),3)*QV(i-1,j));
            else
                q(j)=min(vtmpj(j),3);
            end
        end
    end
    % Termination condition when all rates are 0
    if vtmp==0
        break;
    end
    QV(i,1:N)=q;
    times=exprnd(1./q);
    [r]=find(rate_flag(:,i)==0);
    [Tval,Ival]=min(times(r));
    if(i==2)
        TvalV(i)=Tval;
    else
        TvalV(i)=TvalV(i-1)+Tval;
    end
    for j=r'
        if(j==r(Ival)) % Node that switches
            L(j)=0;
            if X(j)==1
                X(j)=0;
            else
                X(j)=1;
            end
        else
            L(j)=L(j)+1; % X components stay the same so no change
        end
    end
    Lmax=max(L);
end

end